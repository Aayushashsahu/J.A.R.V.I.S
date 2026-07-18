from abc import ABC, abstractmethod
from typing import Iterator, List
import os
from google import genai
from app.core.config import settings
from tenacity import retry, wait_exponential, stop_after_attempt

class BaseLLMProvider(ABC):
    @abstractmethod
    def generate_text(self, prompt: str, system_prompt: str = None) -> str:
        pass
    @abstractmethod
    def generate_text_stream(self, prompt: str, system_prompt: str = None) -> Iterator[str]:
        """
        Yield the LLM response token-by-token (or chunk-by-chunk).

        Each yielded value is a non-empty string fragment.  The caller is
        responsible for concatenating fragments to reconstruct the full
        response if needed.  An empty generator is a valid empty response.
        """

        
    @abstractmethod
    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        pass

class GeminiProvider(BaseLLMProvider):
    def __init__(self):
        api_key = settings.GEMINI_API_KEY or "mock-gemini-key"
        self.client = genai.Client(api_key=api_key)
        self.model = 'gemini-2.5-flash'
        self.embedding_model = 'gemini-embedding-2'
        
        # NVIDIA Fallback
        import logging
        from openai import OpenAI
        self.logger = logging.getLogger(__name__)
        self.nvidia_api_key = os.getenv("NVIDIA_API_KEY", "")
        if not self.nvidia_api_key:
            self.logger.warning("NVIDIA_API_KEY not set — NVIDIA fallback will be unavailable.")
            self.nvidia_client = None
        else:
            self.nvidia_client = OpenAI(
                base_url="https://integrate.api.nvidia.com/v1",
                api_key=self.nvidia_api_key
            )
        self.nvidia_model = "meta/llama-3.1-70b-instruct"

    @retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(5), reraise=True)
    def _generate_text_gemini(self, full_prompt: str) -> str:
        self.logger.info(f"[External API Request] Gemini generate_content model: {self.model}")
        try:
            response = self.client.models.generate_content(
                model=self.model,
                contents=full_prompt
            )
            self.logger.info(f"[External API Response] Gemini generate_content success")
            return response.text
        except Exception as e:
            self.logger.error(f"[External API Error] Gemini generate_content failed: {str(e)}")
            raise e

    def generate_text(self, prompt: str, system_prompt: str = None) -> str:
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        try:
            return self._generate_text_gemini(full_prompt)
        except Exception as e:
            self.logger.warning(f"Gemini generation failed after retries: {e}. Activating NVIDIA Fallback.")
            if self.nvidia_client is None:
                raise RuntimeError("Gemini failed and NVIDIA fallback is not configured (set NVIDIA_API_KEY).") from e
            # NVIDIA Fallback
            try:
                completion = self.nvidia_client.chat.completions.create(
                    model=self.nvidia_model,
                    messages=[{"role": "user", "content": full_prompt}],
                    temperature=0.2,
                    max_tokens=1024
                )
                return completion.choices[0].message.content
            except Exception as nvidia_e:
                self.logger.error(f"NVIDIA fallback also failed: {nvidia_e}")
                raise nvidia_e

    def generate_text_stream(self, prompt: str, system_prompt: str = None) -> Iterator[str]:
        """
        Yield the LLM response as a stream of text chunks.

        Gemini path
        ───────────
        Uses `generate_content_stream()` which yields chunks as soon as the
        model produces them.  Each chunk that carries non-empty text is
        immediately yielded to the caller.

        NVIDIA fallback path
        ────────────────────
        NVIDIA streaming requires an async client which is out of scope here.
        The full response is retrieved in one blocking call and yielded as a
        single chunk so the SSE envelope still works correctly.
        """
        full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt
        try:
            # Gemini: true streaming — yields as tokens arrive
            for chunk in self.client.models.generate_content_stream(
                model=self.model,
                contents=full_prompt,
            ):
                text = getattr(chunk, "text", None)
                if text:
                    yield text
        except Exception as e:
            self.logger.warning(
                f"Gemini stream failed: {e}. Falling back to NVIDIA (single-chunk)."
            )
            if self.nvidia_client is None:
                raise RuntimeError(
                    "Gemini streaming failed and NVIDIA fallback is not configured."
                ) from e
            # NVIDIA: blocking call, yield as one chunk
            try:
                completion = self.nvidia_client.chat.completions.create(
                    model=self.nvidia_model,
                    messages=[{"role": "user", "content": full_prompt}],
                    temperature=0.2,
                    max_tokens=1024,
                )
                text = completion.choices[0].message.content
                if text:
                    yield text
            except Exception as nvidia_e:
                self.logger.error(f"NVIDIA fallback also failed: {nvidia_e}")
                raise nvidia_e

    @retry(wait=wait_exponential(multiplier=1, min=2, max=10), stop=stop_after_attempt(5), reraise=True)
    def generate_embeddings(self, texts: List[str]) -> List[List[float]]:
        # NO FALLBACK FOR EMBEDDINGS (As requested)
        from google.genai import types
        self.logger.info(f"[External API Request] Gemini embed_content model: {self.embedding_model}, texts count: {len(texts)}")
        embeddings = []
        try:
            for text in texts:
                result = self.client.models.embed_content(
                    model=self.embedding_model,
                    contents=text,
                    config=types.EmbedContentConfig(output_dimensionality=768)
                )
                embeddings.append(result.embeddings[0].values)
            self.logger.info(f"[External API Response] Gemini embed_content success, generated {len(embeddings)} vectors")
            return embeddings
        except Exception as e:
            self.logger.error(f"[External API Error] Gemini embed_content failed: {str(e)}")
            raise e

class LLMProviderFactory:
    @staticmethod
    def get_provider(provider_name: str = "gemini") -> BaseLLMProvider:
        if provider_name == "gemini":
            return GeminiProvider()
        # Future: elif provider_name == "openai" ...
        raise ValueError(f"Unknown provider: {provider_name}")

# Global instance for easy import
llm_provider = LLMProviderFactory.get_provider()

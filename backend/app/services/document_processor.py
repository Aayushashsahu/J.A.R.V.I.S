import io
import re
from dataclasses import dataclass
from typing import List, Optional, Tuple

from docx import Document
from PyPDF2 import PdfReader

@dataclass
class ChunkMetadata:
    """
    Metadata produced for every text chunk during ingestion.

    All fields except *text* and *chunk_index* are optional so that
    non-PDF formats (txt, md, docx) can leave page_number as None
    without any special-casing in callers.
    """

    text: str                           # raw chunk content
    chunk_index: int                    # 0-based position in the document
    page_number: Optional[int] = None   # 1-based PDF page; None for non-PDF
    clause_id: Optional[str] = None     # e.g. "Section 3.4" extracted by regex


class DocumentProcessor:
    @staticmethod
    def parse_txt(content: bytes) -> str:
        return content.decode('utf-8')

    @staticmethod
    def parse_md(content: bytes) -> str:
        # For now, treat markdown as text. Advanced usage could strip markdown or parse it
        return content.decode('utf-8')

    @staticmethod
    def parse_pdf(content: bytes) -> str:
        reader = PdfReader(io.BytesIO(content))
        text = ""
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
        return text

    @staticmethod
    def parse_docx(content: bytes) -> str:
        doc = Document(io.BytesIO(content))
        return "\n".join([paragraph.text for paragraph in doc.paragraphs])

    @staticmethod
    def process(filename: str, content: bytes) -> str:
        ext = filename.split('.')[-1].lower()
        if ext == 'txt':
            return DocumentProcessor.parse_txt(content)
        elif ext == 'md':
            return DocumentProcessor.parse_md(content)
        elif ext == 'pdf':
            return DocumentProcessor.parse_pdf(content)
        elif ext == 'docx':
            return DocumentProcessor.parse_docx(content)
        else:
            raise ValueError(f"Unsupported file format: {ext}")

    @staticmethod
    def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 200) -> list[str]:
        chunks = []
        start = 0
        while start < len(text):
            end = start + chunk_size
            chunks.append(text[start:end])
            start += chunk_size - overlap
        return chunks

    # ── Metadata-aware methods ────────────────────────────────────────────
    # These are NEW additions.  All methods above are completely unchanged.

    @staticmethod
    def _parse_pdf_pages(content: bytes) -> List[Tuple[str, int]]:
        """
        Extract text from every non-empty PDF page.

        Returns a list of (page_text, 1-based-page-number) tuples.
        The existing parse_pdf() method is left intact; this variant
        additionally tracks which physical page each block of text came from.
        """
        reader = PdfReader(io.BytesIO(content))
        pages: List[Tuple[str, int]] = []
        for page_num, page in enumerate(reader.pages, start=1):
            page_text = page.extract_text()
            if page_text and page_text.strip():
                pages.append((page_text, page_num))
        return pages

    @staticmethod
    def _chunk_pages(
        pages: List[Tuple[str, int]],
        chunk_size: int = 1000,
        overlap: int = 200,
    ) -> List["ChunkMetadata"]:
        """
        Chunk page-aware text while preserving which page each chunk starts on.

        Strategy
        ────────
        1. Concatenate all pages into one string, recording the character
           offset at which each page begins.
        2. Apply the same sliding-window algorithm as chunk_text().
        3. For each window, walk the page-boundary list backwards to find
           the page whose offset is ≤ the window start.
        """
        # Build full text and record page start offsets.
        full_text = ""
        page_boundaries: List[Tuple[int, int]] = []   # (char_start, page_num)

        for page_text, page_num in pages:
            page_boundaries.append((len(full_text), page_num))
            full_text += page_text + "\n"

        results: List[ChunkMetadata] = []
        chunk_index = 0
        start = 0

        while start < len(full_text):
            end = min(start + chunk_size, len(full_text))
            chunk_text = full_text[start:end]

            # Determine originating page (latest boundary whose start ≤ chunk start).
            page_num = page_boundaries[0][1] if page_boundaries else 1
            for boundary_start, boundary_page in reversed(page_boundaries):
                if start >= boundary_start:
                    page_num = boundary_page
                    break

            results.append(ChunkMetadata(
                text=chunk_text,
                chunk_index=chunk_index,
                page_number=page_num,
                clause_id=DocumentProcessor._extract_clause_id(chunk_text),
            ))

            chunk_index += 1
            start += chunk_size - overlap

        return results

    @staticmethod
    def _extract_clause_id(text: str) -> Optional[str]:
        """
        Extract the first clause / section reference found in *text*.

        Patterns recognised
        ───────────────────
        - "Section 3.4", "Clause 2.1.3", "Article 12", "Rule 5"
        - "Regulation 4.2.1", "Para 6", "§ 3.4"

        Returns the matched string (max 60 chars) or None.
        """
        patterns = [
            r'(?:Section|Clause|Para(?:graph)?|Art(?:icle)?|Rule|Reg(?:ulation)?)'
            r'\s*(\d+(?:\.\d+)*)',
            r'§\s*(\d+(?:\.\d+)*)',
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(0)[:60]
        return None

    @staticmethod
    def process_with_metadata(
        filename: str,
        content: bytes,
        chunk_size: int = 1000,
        overlap: int = 200,
    ) -> List["ChunkMetadata"]:
        """
        Parse and chunk *filename* / *content*, returning a rich metadata
        list instead of plain strings.

        PDF files
        ─────────
        Uses _parse_pdf_pages() + _chunk_pages() so that page_number is
        populated on every ChunkMetadata object.

        All other formats (txt, md, docx)
        ──────────────────────────────────
        Delegates to the *existing* process() and chunk_text() methods
        (no behaviour change) then wraps each chunk in ChunkMetadata with
        page_number=None and a clause_id extracted by regex.
        """
        ext = filename.split('.')[-1].lower()

        if ext == 'pdf':
            pages = DocumentProcessor._parse_pdf_pages(content)
            return DocumentProcessor._chunk_pages(pages, chunk_size, overlap)

        # Non-PDF: reuse the existing, tested parse + chunk pipeline.
        text = DocumentProcessor.process(filename, content)
        raw_chunks = DocumentProcessor.chunk_text(text, chunk_size, overlap)

        return [
            ChunkMetadata(
                text=chunk,
                chunk_index=i,
                page_number=None,
                clause_id=DocumentProcessor._extract_clause_id(chunk),
            )
            for i, chunk in enumerate(raw_chunks)
        ]

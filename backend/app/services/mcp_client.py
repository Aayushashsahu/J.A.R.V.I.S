import asyncio
import logging
from typing import Optional, Dict, Any, List
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client

logger = logging.getLogger(__name__)

class GBrainMCPClient:
    def __init__(self, endpoint: str = "http://127.0.0.1:8001/mcp"):
        self.endpoint = endpoint
        self._session: Optional[ClientSession] = None
        self._sse_ctx = None
        self._session_ctx = None
        self._http_client = None
        self._lock = asyncio.Lock()

    async def connect(self):
        """Establish Streamable HTTP connection to the MCP server."""
        async with self._lock:
            if self._session:
                return

            try:
                import os
                import httpx
                
                gbrain_api_key = os.environ.get("GBRAIN_API_KEY")
                if not gbrain_api_key:
                    bootstrap_token = os.environ.get("GBRAIN_ADMIN_BOOTSTRAP_TOKEN")
                    if bootstrap_token:
                        async with httpx.AsyncClient(follow_redirects=False) as http:
                            r1 = await http.post('http://127.0.0.1:8001/admin/api/issue-magic-link', headers={'Authorization': f'Bearer {bootstrap_token}'})
                            if r1.status_code == 200:
                                nonce = r1.json()['url'].split('/')[-1]
                                r2 = await http.get(f'http://127.0.0.1:8001/admin/auth/{nonce}')
                                if r2.status_code in (200, 302, 303):
                                    cookie = r2.cookies.get('gbrain_admin')
                                    if cookie:
                                        r3 = await http.post('http://127.0.0.1:8001/admin/api/api-keys', json={'name': 'jarvis_backend'}, headers={'Cookie': f'gbrain_admin={cookie}'})
                                        if r3.status_code == 200:
                                            gbrain_api_key = r3.json().get('token')
                                            os.environ["GBRAIN_API_KEY"] = gbrain_api_key
                                            logger.info("Generated new GBrain API Key.")
                                        else:
                                            logger.warning(f"Failed to generate API Key: Status {r3.status_code}")
                                    else:
                                        logger.warning("Could not extract gbrain_admin cookie from Magic Link.")
                                else:
                                    logger.warning(f"Magic Link redemption failed: Status {r2.status_code}")
                            else:
                                logger.warning(f"Magic Link issuance failed: Status {r1.status_code}")
                
                headers = {}
                if gbrain_api_key:
                    headers["Authorization"] = f"Bearer {gbrain_api_key}"
                # Must specify Accept header for Streamable HTTP
                headers["Accept"] = "application/json, text/event-stream"

                # Use context managers manually so we can keep the connection open
                self._http_client = httpx.AsyncClient(headers=headers, timeout=httpx.Timeout(5, read=300))
                self._sse_ctx = streamable_http_client(self.endpoint, http_client=self._http_client)
                read_stream, write_stream, _ = await self._sse_ctx.__aenter__()
                
                self._session_ctx = ClientSession(read_stream, write_stream)
                self._session = await self._session_ctx.__aenter__()
                
                await self._session.initialize()
                logger.info("Connected to GBrain MCP Server successfully.")
            except Exception as e:
                logger.error(f"Failed to connect to GBrain MCP Server at {self.endpoint}: {e}")
                # Clean up contexts without acquiring the lock again
                self._session_ctx = None
                self._sse_ctx = None
                raise e

    async def close(self):
        """Close the MCP connection."""
        async with self._lock:
            if self._session_ctx:
                try:
                    await self._session_ctx.__aexit__(None, None, None)
                except Exception as e:
                    logger.warning(f"Error closing session: {e}")
                self._session_ctx = None
                self._session = None
            
            if self._sse_ctx:
                try:
                    await self._sse_ctx.__aexit__(None, None, None)
                except Exception as e:
                    logger.warning(f"Error closing SSE: {e}")
                self._sse_ctx = None
                
            logger.info("Disconnected from GBrain MCP Server.")

    async def search(self, query: str) -> str:
        """Call the search capability on GBrain"""
        if not self._session:
            await self.connect()
            
        try:
            # We assume GBrain exposes a tool named 'search'
            # Let's list tools to be sure if this was dynamic, but we'll hardcode 'search' for now
            result = await self._session.call_tool("search", arguments={"query": query})
            # Convert CallToolResult back to string
            if hasattr(result, "content") and result.content:
                if isinstance(result.content, list):
                    return "\n".join([str(c.text) for c in result.content if hasattr(c, "text")])
            return str(result)
        except Exception as e:
            logger.error(f"GBrain search failed: {e}")
            return ""

    async def think(self, query: str) -> str:
        """Call the think capability on GBrain to synthesize a response"""
        if not self._session:
            await self.connect()
            
        try:
            # We assume GBrain exposes a tool named 'think'
            result = await self._session.call_tool("think", arguments={"query": query})
            if hasattr(result, "content") and result.content:
                if isinstance(result.content, list):
                    return "\n".join([str(c.text) for c in result.content if hasattr(c, "text")])
            return str(result)
        except Exception as e:
            logger.error(f"GBrain think failed: {e}")
            return ""

# Singleton instance
gbrain_client = GBrainMCPClient()

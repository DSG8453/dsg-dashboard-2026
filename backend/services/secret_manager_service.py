"""
Google Cloud Secret Manager Service
Place this file at: backend/services/secret_manager_service.py
"""

import os
import logging
from google.cloud import secretmanager
from typing import Optional, Dict
from fastapi import HTTPException

logger = logging.getLogger(__name__)

class SecretManagerService:
    def __init__(self):
        self.project_id = os.getenv('GCP_PROJECT_ID', 'dsg-transport-platform')
        
        try:
            self.client = secretmanager.SecretManagerServiceClient()
            self.cache: Dict[str, str] = {}
            logger.info(f"✅ Secret Manager initialized for project: {self.project_id}")
        except Exception as e:
            logger.error(f"❌ Failed to initialize Secret Manager: {str(e)}")
            self.client = None
            self.cache = {}
    
    def get_secret(self, secret_name: str, version: str = "latest") -> Optional[str]:
        if not self.client:
            raise HTTPException(
                status_code=500,
                detail="Secret Manager not initialized. Check GCP_PROJECT_ID environment variable."
            )
        
        cache_key = f"{secret_name}:{version}"
        
        if cache_key in self.cache:
            logger.debug(f"📦 Retrieved {secret_name} from cache")
            return self.cache[cache_key]
        
        try:
            name = f"projects/{self.project_id}/secrets/{secret_name}/versions/{version}"
            response = self.client.access_secret_version(request={"name": name})
            secret_value = response.payload.data.decode('UTF-8')
            
            self.cache[cache_key] = secret_value
            logger.info(f"✅ Retrieved secret: {secret_name}")
            return secret_value
            
        except Exception as e:
            logger.error(f"❌ Failed to retrieve secret {secret_name}: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve secret: {secret_name}"
            )
    
    def get_tool_credentials(self, tool_name: str) -> Dict[str, str]:
        try:
            tool_name = tool_name.lower().replace(" ", "-").replace(".", "")
            
            credentials = {
                "username": self.get_secret(f"{tool_name}-username"),
                "password": self.get_secret(f"{tool_name}-password")
            }
            
            logger.info(f"✅ Retrieved credentials for tool: {tool_name}")
            return credentials
            
        except Exception as e:
            logger.error(f"❌ Failed to get {tool_name} credentials: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve credentials for {tool_name}"
            )
    
    def clear_cache(self):
        self.cache = {}
        logger.info("🔄 Secret cache cleared")

# Global instance
secret_manager = SecretManagerService()

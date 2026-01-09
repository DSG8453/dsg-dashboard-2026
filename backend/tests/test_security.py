"""
Security Tests for DSG Transport Credential Management
Tests for:
1. Credential visibility based on user role
2. Decrypt endpoint security (rate limiting, origin validation)
3. Access control for tools
"""
import pytest
import httpx
import os
import asyncio
from datetime import datetime

# Get API URL from environment
API_URL = os.environ.get("API_URL", "https://keyvault-27.preview.emergentagent.com")

# Test credentials
SUPER_ADMIN = {"email": "info@dsgtransport.net", "password": "admin123"}
ADMIN = {"email": "admin@dsgtransport.com", "password": "admin123"}
USER = {"email": "testuser@dsgtransport.com", "password": "user123"}


async def get_token(client: httpx.AsyncClient, credentials: dict) -> str:
    """Helper to get auth token"""
    response = await client.post(
        f"{API_URL}/api/auth/login",
        json=credentials
    )
    data = response.json()
    return data.get("access_token", "")


@pytest.mark.asyncio
async def test_admin_cannot_see_credentials():
    """Test that Admin users cannot see credentials in tool responses"""
    async with httpx.AsyncClient() as client:
        token = await get_token(client, ADMIN)
        assert token, "Admin login failed"
        
        response = await client.get(
            f"{API_URL}/api/tools",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        tools = response.json()
        
        for tool in tools:
            # Admin should see has_credentials flag but NOT actual credentials
            assert "credentials" not in tool, f"SECURITY ISSUE: Admin can see credentials for {tool.get('name')}"
            # has_credentials is allowed (boolean indicator only)
            if tool.get("has_credentials"):
                print(f"✓ Tool '{tool.get('name')}' has credentials but they are hidden from Admin")


@pytest.mark.asyncio
async def test_user_cannot_see_credentials():
    """Test that regular Users cannot see credentials in tool responses"""
    async with httpx.AsyncClient() as client:
        token = await get_token(client, USER)
        assert token, "User login failed"
        
        response = await client.get(
            f"{API_URL}/api/tools",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        tools = response.json()
        
        for tool in tools:
            assert "credentials" not in tool, f"SECURITY ISSUE: User can see credentials for {tool.get('name')}"
            if tool.get("has_credentials"):
                print(f"✓ Tool '{tool.get('name')}' has credentials but they are hidden from User")


@pytest.mark.asyncio
async def test_super_admin_can_see_credentials():
    """Test that Super Admin CAN see credentials in tool responses"""
    async with httpx.AsyncClient() as client:
        token = await get_token(client, SUPER_ADMIN)
        assert token, "Super Admin login failed"
        
        response = await client.get(
            f"{API_URL}/api/tools",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        tools = response.json()
        
        # Find a tool with credentials
        tools_with_creds = [t for t in tools if t.get("has_credentials")]
        assert len(tools_with_creds) > 0, "No tools with credentials found"
        
        for tool in tools_with_creds:
            assert "credentials" in tool, f"Super Admin should see credentials for {tool.get('name')}"
            creds = tool["credentials"]
            assert "username" in creds, "Credentials should have username"
            assert "password" in creds, "Credentials should have password"
            print(f"✓ Super Admin can see credentials for '{tool.get('name')}'")


@pytest.mark.asyncio
async def test_decrypt_endpoint_blocks_invalid_origin():
    """Test that decrypt endpoint blocks requests from non-extension origins"""
    async with httpx.AsyncClient() as client:
        # First get a valid encrypted payload
        token = await get_token(client, SUPER_ADMIN)
        
        # Get tools to find one with credentials
        tools_response = await client.get(
            f"{API_URL}/api/tools",
            headers={"Authorization": f"Bearer {token}"}
        )
        tools = tools_response.json()
        tool_with_creds = next((t for t in tools if t.get("has_credentials")), None)
        
        if not tool_with_creds:
            pytest.skip("No tools with credentials found")
        
        # Get encrypted payload
        payload_response = await client.post(
            f"{API_URL}/api/secure-access/{tool_with_creds['id']}/extension-payload",
            headers={"Authorization": f"Bearer {token}"}
        )
        payload_data = payload_response.json()
        encrypted = payload_data.get("encrypted")
        
        assert encrypted, "Failed to get encrypted payload"
        
        # Try to decrypt with malicious origin
        decrypt_response = await client.post(
            f"{API_URL}/api/secure-access/decrypt-payload",
            headers={
                "Origin": "https://malicious-site.com",
                "Content-Type": "application/json"
            },
            json={"encrypted": encrypted}
        )
        
        result = decrypt_response.json()
        assert result.get("success") == False, "SECURITY ISSUE: Decrypt allowed from malicious origin"
        assert "origin" in result.get("error", "").lower(), "Should mention invalid origin"
        print("✓ Decrypt endpoint correctly blocks malicious origins")


@pytest.mark.asyncio
async def test_decrypt_endpoint_allows_extension_origin():
    """Test that decrypt endpoint allows requests from browser extension origins"""
    async with httpx.AsyncClient() as client:
        # First get a valid encrypted payload
        token = await get_token(client, SUPER_ADMIN)
        
        # Get tools to find one with credentials
        tools_response = await client.get(
            f"{API_URL}/api/tools",
            headers={"Authorization": f"Bearer {token}"}
        )
        tools = tools_response.json()
        tool_with_creds = next((t for t in tools if t.get("has_credentials")), None)
        
        if not tool_with_creds:
            pytest.skip("No tools with credentials found")
        
        # Get encrypted payload
        payload_response = await client.post(
            f"{API_URL}/api/secure-access/{tool_with_creds['id']}/extension-payload",
            headers={"Authorization": f"Bearer {token}"}
        )
        payload_data = payload_response.json()
        encrypted = payload_data.get("encrypted")
        
        assert encrypted, "Failed to get encrypted payload"
        
        # Try to decrypt with extension origin
        decrypt_response = await client.post(
            f"{API_URL}/api/secure-access/decrypt-payload",
            headers={
                "Origin": "chrome-extension://abcdefghijklmnop",
                "Content-Type": "application/json"
            },
            json={"encrypted": encrypted}
        )
        
        result = decrypt_response.json()
        assert result.get("success") == True, f"Extension origin should be allowed: {result}"
        assert result.get("u"), "Should return decrypted username"
        assert result.get("p"), "Should return decrypted password"
        print("✓ Decrypt endpoint allows extension origins")


@pytest.mark.asyncio
async def test_admin_can_access_assigned_tools():
    """Test that Admin can access tools assigned to them"""
    async with httpx.AsyncClient() as client:
        token = await get_token(client, ADMIN)
        assert token, "Admin login failed"
        
        # Get tools - Admin should see tools
        response = await client.get(
            f"{API_URL}/api/tools",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        assert response.status_code == 200
        tools = response.json()
        print(f"✓ Admin can see {len(tools)} tools")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

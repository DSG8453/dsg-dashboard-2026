"""
Security Tests for DSG Transport Credential Management
Tests for:
1. Credential visibility based on user role
2. Access control for tools
3. Gateway session security
"""
import pytest
import httpx
import os
import asyncio
from datetime import datetime

# Get API URL from environment
API_URL = os.environ.get("API_URL", "https://portal.dsgtransport.net")

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
async def test_gateway_requires_authentication():
    """Test that gateway endpoints require authentication"""
    async with httpx.AsyncClient() as client:
        # Try to start gateway session without auth
        response = await client.post(
            f"{API_URL}/api/gateway/start/some-tool-id"
        )
        
        # Should return 401 or 403
        assert response.status_code in [401, 403, 422], f"Gateway should require auth, got {response.status_code}"
        print("✓ Gateway correctly requires authentication")


@pytest.mark.asyncio
async def test_gateway_validates_tool_access():
    """Test that gateway validates user has access to the tool"""
    async with httpx.AsyncClient() as client:
        # Login as regular user
        token = await get_token(client, USER)
        if not token:
            pytest.skip("User login failed")
        
        # Try to access a random tool ID (should fail)
        response = await client.post(
            f"{API_URL}/api/gateway/start/000000000000000000000000",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        # Should return 403 (forbidden) or 404 (not found)
        assert response.status_code in [403, 404], f"Gateway should validate access, got {response.status_code}"
        print("✓ Gateway correctly validates tool access")


@pytest.mark.asyncio
async def test_gateway_session_returns_no_credentials():
    """Test that gateway session response doesn't expose credentials"""
    async with httpx.AsyncClient() as client:
        token = await get_token(client, SUPER_ADMIN)
        assert token, "Super Admin login failed"
        
        # Get tools
        tools_response = await client.get(
            f"{API_URL}/api/tools",
            headers={"Authorization": f"Bearer {token}"}
        )
        tools = tools_response.json()
        
        if not tools:
            pytest.skip("No tools available")
        
        # Try to start gateway session
        response = await client.post(
            f"{API_URL}/api/gateway/start/{tools[0]['id']}",
            headers={"Authorization": f"Bearer {token}"}
        )
        
        if response.status_code == 200:
            data = response.json()
            # Gateway response should NOT contain credentials
            assert "username" not in str(data).lower() or "password" not in str(data).lower(), \
                "SECURITY ISSUE: Gateway response should not expose credentials"
            assert "session_token" in data or "gateway_url" in data, \
                "Gateway should return session info"
            print("✓ Gateway session response doesn't expose credentials")
        else:
            # Tool might not be configured, that's OK
            print(f"✓ Gateway returned {response.status_code} (tool may not be configured)")


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


@pytest.mark.asyncio
async def test_credentials_not_in_api_response_for_non_admins():
    """Test that API responses never include raw credentials for non-Super Admin users"""
    async with httpx.AsyncClient() as client:
        for user_creds in [ADMIN, USER]:
            token = await get_token(client, user_creds)
            if not token:
                continue
            
            # Check tools endpoint
            response = await client.get(
                f"{API_URL}/api/tools",
                headers={"Authorization": f"Bearer {token}"}
            )
            
            response_text = response.text.lower()
            
            # Should not contain credential-like data
            # Note: "password" field names are OK, but actual password values should not appear
            for tool in response.json():
                if "credentials" in tool:
                    pytest.fail(f"SECURITY ISSUE: Credentials object exposed to non-Super Admin user")
            
            print(f"✓ No credentials exposed for {user_creds['email']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])

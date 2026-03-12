#!/usr/bin/env bash
#
# AI Sandbox Platform - Single-Command Startup Orchestration
#
# Phase 35B-2: Startup Orchestration
#
# Starts all required services in the correct order:
# 1. PostgreSQL (via Docker)
# 2. API Gateway
# 3. AI Service
# 4. Frontend
#
# Performs readiness checks before declaring success.
#
# Scope: FRONTEND + LOCAL DEV TOOLING ONLY
# No backend code changes, no new API endpoints
#

set -e

# Configuration
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-30}
HEALTH_CHECK_INTERVAL=${HEALTH_CHECK_INTERVAL:-2}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Output functions
write_step() {
    echo -e "${CYAN}🔷 $1${NC}"
}

write_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

write_failure() {
    echo -e "${RED}❌ $1${NC}"
}

write_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

write_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
    echo -e "${WHITE} $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
    echo ""
}

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Wait for health endpoint to be ready
wait_for_health_endpoint() {
    local url=$1
    local service_name=$2
    local timeout=${3:-30}
    local interval=${4:-2}
    
    local elapsed=0
    write_step "Waiting for $service_name to be ready..."
    
    while [ $elapsed -lt $timeout ]; do
        if curl -s -f "$url" >/dev/null 2>&1; then
            local response=$(curl -s "$url")
            if echo "$response" | grep -q '"status":"ok"' || echo "$response" | grep -q '"status":"ready"'; then
                echo ""
                write_success "$service_name is ready!"
                return 0
            fi
        fi
        
        sleep $interval
        elapsed=$((elapsed + interval))
        echo -n "."
    done
    
    echo ""
    write_failure "$service_name did not become ready within $timeout seconds"
    return 1
}

# Check if PostgreSQL is running
test_postgresql() {
    docker ps --filter "name=aisandbox-postgres" --filter "status=running" --format "{{.Names}}" | grep -q "aisandbox-postgres"
}

# Check if a port is in use
test_port() {
    local port=$1
    nc -z localhost "$port" 2>/dev/null || lsof -i ":$port" >/dev/null 2>&1
}

# Main orchestration
write_header "AI Sandbox Platform - Startup Orchestration"
write_info "Phase 35B-2: Single-Command Startup"
write_info "Health Check Timeout: $HEALTH_CHECK_TIMEOUT seconds"
echo ""

# Step 0: Prerequisites check
write_step "Checking prerequisites..."

if ! command_exists docker; then
    write_failure "Docker is not installed or not in PATH"
    write_info "Install Docker: https://www.docker.com/products/docker-desktop"
    exit 1
fi

if ! command_exists node; then
    write_failure "Node.js is not installed or not in PATH"
    write_info "Install Node.js: https://nodejs.org/"
    exit 1
fi

if ! command_exists npm; then
    write_failure "npm is not installed or not in PATH"
    write_info "npm should be included with Node.js"
    exit 1
fi

if ! command_exists curl; then
    write_failure "curl is not installed or not in PATH"
    write_info "Install curl for your system"
    exit 1
fi

write_success "All prerequisites are installed"

# Step 1: Start PostgreSQL
write_header "Step 1: Starting PostgreSQL"

if test_postgresql; then
    write_success "PostgreSQL is already running"
else
    write_step "Starting PostgreSQL container..."
    
    if ! docker-compose up -d postgres; then
        write_failure "Failed to start PostgreSQL"
        write_info "Remediation:"
        write_info "  1. Check Docker is running: docker ps"
        write_info "  2. Check docker-compose.yml exists"
        write_info "  3. Check logs: docker logs aisandbox-postgres"
        exit 1
    fi
    
    write_step "Waiting for PostgreSQL to be ready..."
    sleep 5
    
    # Wait for PostgreSQL health check
    max_wait=30
    waited=0
    while [ $waited -lt $max_wait ]; do
        health=$(docker inspect --format='{{.State.Health.Status}}' aisandbox-postgres 2>/dev/null || echo "unknown")
        if [ "$health" = "healthy" ]; then
            echo ""
            write_success "PostgreSQL is healthy"
            break
        fi
        sleep 2
        waited=$((waited + 2))
        echo -n "."
    done
    
    if [ $waited -ge $max_wait ]; then
        echo ""
        write_failure "PostgreSQL did not become healthy within $max_wait seconds"
        write_info "Check logs: docker logs aisandbox-postgres"
        exit 1
    fi
fi

# Step 2: Start API Gateway
write_header "Step 2: Starting API Gateway"

if test_port 4000; then
    write_info "Port 4000 is already in use (API Gateway may already be running)"
else
    write_step "Starting API Gateway..."
    
    # Check if api-gateway directory exists
    if [ ! -d "services/api-gateway" ]; then
        write_failure "services/api-gateway directory not found"
        exit 1
    fi
    
    # Start API Gateway in background
    cd services/api-gateway
    npm run dev > /dev/null 2>&1 &
    api_gateway_pid=$!
    cd ../..
    
    write_info "API Gateway process started (PID: $api_gateway_pid)"
    
    # Wait for API Gateway to be ready
    if ! wait_for_health_endpoint "http://localhost:4000/api/health" "API Gateway" "$HEALTH_CHECK_TIMEOUT" "$HEALTH_CHECK_INTERVAL"; then
        write_failure "API Gateway failed to start"
        write_info "Remediation:"
        write_info "  1. Check if port 4000 is available"
        write_info "  2. Check services/api-gateway/.env file exists"
        write_info "  3. Run manually: cd services/api-gateway && npm run dev"
        kill $api_gateway_pid 2>/dev/null || true
        exit 1
    fi
fi

# Step 3: Check API Gateway readiness (full check)
write_header "Step 3: Verifying API Gateway Readiness"

write_step "Checking /api/health/ready endpoint..."

if ! ready_response=$(curl -s -f "http://localhost:4000/api/health/ready" 2>/dev/null); then
    write_failure "Failed to verify API Gateway readiness"
    write_info "Remediation:"
    write_info "  1. Check if API Gateway is running: curl http://localhost:4000/api/health"
    write_info "  2. Check database is accessible"
    write_info "  3. Review API Gateway logs"
    exit 1
fi

if echo "$ready_response" | grep -q '"status":"ready"'; then
    write_success "API Gateway is fully ready"
    
    # Extract and display check results
    env_check=$(echo "$ready_response" | grep -o '"environment":"[^"]*"' | cut -d'"' -f4)
    db_check=$(echo "$ready_response" | grep -o '"database":"[^"]*"' | cut -d'"' -f4)
    ks_check=$(echo "$ready_response" | grep -o '"killSwitches":"[^"]*"' | cut -d'"' -f4)
    sl_check=$(echo "$ready_response" | grep -o '"safetyLimits":"[^"]*"' | cut -d'"' -f4)
    
    write_info "  Environment: $env_check"
    write_info "  Database: $db_check"
    write_info "  Kill Switches: $ks_check"
    write_info "  Safety Limits: $sl_check"
else
    write_failure "API Gateway is not ready"
    error_msg=$(echo "$ready_response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$error_msg" ]; then
        write_info "Error: $error_msg"
    fi
    write_info "Remediation:"
    write_info "  1. Check database connection"
    write_info "  2. Check environment variables in services/api-gateway/.env"
    write_info "  3. Check logs in API Gateway terminal"
    exit 1
fi

# Step 4: Start AI Service
write_header "Step 4: Starting AI Service"

if test_port 4001; then
    write_info "Port 4001 is already in use (AI Service may already be running)"
else
    write_step "Starting AI Service..."
    
    # Check if ai-service directory exists
    if [ ! -d "services/ai-service" ]; then
        write_failure "services/ai-service directory not found"
        exit 1
    fi
    
    # Start AI Service in background
    cd services/ai-service
    npm run dev > /dev/null 2>&1 &
    ai_service_pid=$!
    cd ../..
    
    write_info "AI Service process started (PID: $ai_service_pid)"
    
    # Wait for AI Service to be ready
    if ! wait_for_health_endpoint "http://localhost:4001/health" "AI Service" "$HEALTH_CHECK_TIMEOUT" "$HEALTH_CHECK_INTERVAL"; then
        write_failure "AI Service failed to start"
        write_info "Remediation:"
        write_info "  1. Check if port 4001 is available"
        write_info "  2. Check services/ai-service/.env file exists"
        write_info "  3. Check AI provider API keys are configured"
        write_info "  4. Run manually: cd services/ai-service && npm run dev"
        kill $ai_service_pid 2>/dev/null || true
        exit 1
    fi
fi

# Step 5: Start Frontend
write_header "Step 5: Starting Frontend"

test_frontend_http() {
    local timeout=${1:-5}
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "http://localhost:3002/" 2>/dev/null)
    [ -n "$status" ] && [ "$status" -ge 200 ] && [ "$status" -lt 600 ]
}

start_frontend_fresh() {
    if [ -d "frontend/.next" ]; then
        write_step "Cleaning stale .next cache..."
        rm -rf "frontend/.next"
    fi
    cd frontend
    npm run dev > /dev/null 2>&1 &
    frontend_pid=$!
    cd ..
    write_info "Frontend process started (PID: $frontend_pid)"
}

wait_for_frontend_http() {
    local timeout=${1:-30}
    local interval=${2:-2}
    local elapsed=0
    write_step "Waiting for Frontend HTTP readiness..."
    while [ $elapsed -lt $timeout ]; do
        if test_frontend_http 3; then
            echo ""
            write_success "Frontend is serving HTTP responses!"
            return 0
        fi
        sleep $interval
        elapsed=$((elapsed + interval))
        echo -n "."
    done
    echo ""
    write_failure "Frontend did not become HTTP-ready within $timeout seconds"
    return 1
}

if test_port 3002; then
    write_info "Port 3002 is in use — verifying Frontend HTTP health..."
    if test_frontend_http 5; then
        write_success "Frontend is healthy and serving HTTP responses!"
    else
        write_failure "Frontend process is degraded (port open but not serving HTTP)"
        write_step "Killing stale Frontend process on port 3002..."
        stale_pid=$(lsof -ti :3002 2>/dev/null || ss -tlnp 'sport = :3002' 2>/dev/null | grep -oP 'pid=\K[0-9]+' | head -1)
        if [ -n "$stale_pid" ]; then
            kill -9 "$stale_pid" 2>/dev/null || true
            write_info "Killed stale process (PID: $stale_pid)"
            sleep 2
        fi
        start_frontend_fresh
        if ! wait_for_frontend_http "$HEALTH_CHECK_TIMEOUT" "$HEALTH_CHECK_INTERVAL"; then
            write_failure "Frontend failed to recover"
            write_info "Remediation:"
            write_info "  1. Check frontend logs"
            write_info "  2. Run manually: cd frontend && npm run dev"
            kill $frontend_pid 2>/dev/null || true
            exit 1
        fi
    fi
else
    write_step "Starting Frontend..."
    if [ ! -d "frontend" ]; then
        write_failure "frontend directory not found"
        exit 1
    fi
    start_frontend_fresh
    if ! wait_for_frontend_http "$HEALTH_CHECK_TIMEOUT" "$HEALTH_CHECK_INTERVAL"; then
        write_failure "Frontend failed to start"
        write_info "Remediation:"
        write_info "  1. Check if port 3002 is available"
        write_info "  2. Run manually: cd frontend && npm run dev"
        kill $frontend_pid 2>/dev/null || true
        exit 1
    fi
fi

# Final success message
write_header "🎉 Startup Complete!"

write_success "All services are running:"
echo ""
echo -e "${WHITE}  🗄️  PostgreSQL:   ${CYAN}localhost:5432${NC}"
echo -e "${WHITE}  🌐 API Gateway:  ${CYAN}http://localhost:4000${NC}"
echo -e "${WHITE}  🤖 AI Service:   ${CYAN}http://localhost:4001${NC}"
echo -e "${WHITE}  💻 Frontend:     ${CYAN}http://localhost:3002${NC}"
echo ""
write_info "Open your browser to http://localhost:3002 to start using the platform"
write_info "Press Ctrl+C in each terminal to stop services"
echo ""

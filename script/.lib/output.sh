#!/bin/bash
# Output formatting library for consistent script styling.
# Source this file in your scripts with: source "$SCRIPT_DIR/.lib/output.sh"
# shellcheck disable=SC2034  # All variables in this library are used by sourcing scripts

# Color codes
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly BOLD='\033[1m'
readonly NC='\033[0m' # No Color

# Unicode symbols
readonly CHECK='✓'
readonly CROSS='✗'

log_header() {
    printf "\n%b==> %b%b\n" "$BOLD$BLUE" "$1" "$NC"
}

log_success() {
    printf "%b%s %b%b\n" "$GREEN" "$CHECK" "$1" "$NC"
}

log_error() {
    printf "%b%s %b%b\n" "$RED" "$CROSS" "$1" "$NC" >&2
}

log_info() {
    printf "%b%s%b\n" "$YELLOW" "$1" "$NC"
}

# Fail fast with an installation hint when Bun is unavailable.
require_bun() {
    if ! command -v bun >/dev/null 2>&1; then
        log_error "bun is required but was not found"
        log_info "Install it: https://bun.sh (or: brew install oven-sh/bun/bun)"
        exit 1
    fi
}

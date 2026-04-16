#!/bin/sh
set -eu

bun run migrate
exec bun run start

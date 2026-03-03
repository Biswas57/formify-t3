#!/bin/bash
set -e

echo "Applying database migrations..."
export DEBIAN_FRONTEND=noninteractive

# Apply the migration SQL directly
npx prisma db execute --file prisma/migrations/20260303155240_add_billing_and_paywall/migration.sql --schema prisma/schema.prisma

echo "Migration completed successfully!"

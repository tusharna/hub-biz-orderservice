#!/usr/bin/env bash
# Fill these. Do not commit real secrets.
set -euo pipefail
LOCATION="${LOCATION:-eastus}"
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-ecommerce-dev}"
COSMOS_ACCOUNT="${COSMOS_ACCOUNT:-cosmos-ecommerce-dev}"
SERVICE_BUS_NAMESPACE="${SERVICE_BUS_NAMESPACE:-sb-ecommerce-dev}"
REDIS_NAME="${REDIS_NAME:-redis-ecommerce-dev}"
CONTAINERAPPS_ENV="${CONTAINERAPPS_ENV:-cae-ecommerce-dev}"

az group create --name "$RESOURCE_GROUP" --location "$LOCATION"

az cosmosdb create --name "$COSMOS_ACCOUNT" --resource-group "$RESOURCE_GROUP" --locations regionName="$LOCATION"
az cosmosdb sql database create --account-name "$COSMOS_ACCOUNT" --resource-group "$RESOURCE_GROUP" --name ecommerce
az cosmosdb sql container create \
  --account-name "$COSMOS_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --database-name ecommerce \
  --name orders \
  --partition-key-path /orderId \
  --ttl -1

az servicebus namespace create --name "$SERVICE_BUS_NAMESPACE" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --sku Standard
az servicebus queue create --namespace-name "$SERVICE_BUS_NAMESPACE" --resource-group "$RESOURCE_GROUP" --name orders-queue --max-delivery-count 10
az servicebus topic create --namespace-name "$SERVICE_BUS_NAMESPACE" --resource-group "$RESOURCE_GROUP" --name orders-topic
for sub in payment-subscription inventory-subscription notification-subscription; do
  az servicebus topic subscription create \
    --namespace-name "$SERVICE_BUS_NAMESPACE" \
    --resource-group "$RESOURCE_GROUP" \
    --topic-name orders-topic \
    --name "$sub" \
    --max-delivery-count 10
done
az servicebus topic subscription rule create \
  --namespace-name "$SERVICE_BUS_NAMESPACE" \
  --resource-group "$RESOURCE_GROUP" \
  --topic-name orders-topic \
  --subscription-name notification-subscription \
  --name email-only \
  --filter-sql-expression "notificationType = 'email'" || true

az redis create --name "$REDIS_NAME" --resource-group "$RESOURCE_GROUP" --location "$LOCATION" --sku Basic --vm-size c0
az containerapp env create --name "$CONTAINERAPPS_ENV" --resource-group "$RESOURCE_GROUP" --location "$LOCATION"

echo "Assign Cosmos DB Built-in Data Contributor and Azure Service Bus Data Owner to each Container App managed identity before production."
echo "You must still provide COSMOS_ENDPOINT and SERVICE_BUS_NAMESPACE host names to the apps."

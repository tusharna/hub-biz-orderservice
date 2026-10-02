# Orders

NestJS app for an order flow on Azure Cosmos DB and Azure Service Bus. The page at `http://localhost:3000/` creates orders, loads them, and updates status.

Stock reservation is a separate app in the sibling `Inventory` folder. It listens on `inventory-subscription`. This repo does not consume that subscription.

## Read next

1. [docs/overview.md](docs/overview.md)
2. [docs/how-to-run.md](docs/how-to-run.md)
3. [docs/walkthrough.md](docs/walkthrough.md)

`azure-service-bus-cursor-execution.md` is the original build plan. The `docs/` folder describes the code as it runs now.

## Run

```bash
npm install
cp .env.example .env
npm run start:dev
```

Fill Cosmos and Service Bus values in `.env` before starting. The app refuses to boot when `SERVICE_BUS_CONNECTION_STRING` is empty.

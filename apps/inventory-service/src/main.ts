process.env.APP_ROLE ??= 'inventory-service';
process.env.OUTBOX_PUBLISHER_ENABLED ??= 'false';
// This process no longer receives inventory-subscription.
// The separate Inventory app owns stock reservation.
import { bootstrap } from '../../../src/bootstrap';

void bootstrap();

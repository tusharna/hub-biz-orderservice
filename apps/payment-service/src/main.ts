process.env.APP_ROLE ??= 'payment-service';
process.env.OUTBOX_PUBLISHER_ENABLED ??= 'false';
import { bootstrap } from '../../../src/bootstrap';

void bootstrap();

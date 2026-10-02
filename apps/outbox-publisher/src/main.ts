process.env.APP_ROLE ??= 'outbox-publisher';
process.env.OUTBOX_PUBLISHER_ENABLED ??= 'true';
process.env.SERVICE_BUS_CONSUMER_ENABLED ??= 'false';
import { bootstrap } from '../../../src/bootstrap';

void bootstrap();

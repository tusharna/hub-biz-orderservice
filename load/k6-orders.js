import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: Number(__ENV.VUS || 1),
  duration: __ENV.DURATION || '30s',
};

const baseUrl = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const response = http.post(
    `${baseUrl}/orders`,
    JSON.stringify({
      userId: `user-${__VU}`,
      items: [{ productId: 'product-100', quantity: 1, price: 100 }],
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(response, { 'created': (res) => res.status === 201 });
  sleep(1);
}

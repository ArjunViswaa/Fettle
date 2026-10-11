import { dateRange } from '@fettle/shared';
import type { App } from '../../app.js';
import { currentWeightKg } from '../profile/profile.service.js';
import { evaluateAchievements } from './achievements.service.js';
import { dailySeries } from './insights.service.js';

export async function insightRoutes(app: App) {
  app.get('/insights/daily', { schema: { querystring: dateRange } }, async (request) => {
    const { from, to } = request.query;
    return dailySeries(request.userId, from, to, await currentWeightKg(request.userId));
  });

  app.get('/achievements', async (request) => evaluateAchievements(request.userId));
}

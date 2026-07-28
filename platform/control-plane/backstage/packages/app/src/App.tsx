import { createApp } from '@backstage/frontend-defaults';
import catalogPlugin from '@backstage/plugin-catalog/alpha';
import { navModule } from './modules/nav';
import { ccusScreenDesignsPlugin } from './plugins/ccus-screen-designs/plugin';

export default createApp({
  features: [catalogPlugin, ccusScreenDesignsPlugin, navModule],
});

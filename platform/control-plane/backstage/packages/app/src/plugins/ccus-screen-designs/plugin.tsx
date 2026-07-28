import {
  PageBlueprint,
  createFrontendPlugin,
  createRouteRef,
} from '@backstage/frontend-plugin-api';
import DashboardIcon from '@material-ui/icons/Dashboard';

const catalogRouteRef = createRouteRef();
const screenSpaceRouteRef = createRouteRef();
const projectControlRouteRef = createRouteRef();

const screenDesignsPage = PageBlueprint.make({
  params: {
    routeRef: catalogRouteRef,
    path: '/ccus-screen-designs',
    title: 'CCUS 화면 설계',
    icon: <DashboardIcon />,
    loader: () =>
      import('./ScreenDesignCatalogPage').then(module => (
        <module.ScreenDesignCatalogPage />
      )),
  },
});

const screenSpacePage = PageBlueprint.make({
  name: 'screen-space',
  params: {
    routeRef: screenSpaceRouteRef,
    path: '/ccus-screen-space',
    title: 'CCUS 화면 공간 엔진',
    icon: <DashboardIcon />,
    loader: () =>
      import('./ScreenSpaceEnginePage').then(module => (
        <module.ScreenSpaceEnginePage />
      )),
  },
});

const projectControlPage = PageBlueprint.make({
  name: 'project-control',
  params: {
    routeRef: projectControlRouteRef,
    path: '/resonance-projects',
    title: 'Resonance 프로젝트 제어',
    icon: <DashboardIcon />,
    loader: () =>
      import('./ResonanceProjectControlPage').then(module => (
        <module.ResonanceProjectControlPage />
      )),
  },
});

export const ccusScreenDesignsPlugin = createFrontendPlugin({
  pluginId: 'ccus-screen-designs',
  title: 'CCUS 화면 설계',
  icon: <DashboardIcon />,
  routes: {
    root: catalogRouteRef,
    screenSpace: screenSpaceRouteRef,
    projectControl: projectControlRouteRef,
  },
  extensions: [screenDesignsPage, screenSpacePage, projectControlPage],
});

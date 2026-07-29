import {
  PageBlueprint,
  createFrontendPlugin,
  createRouteRef,
} from '@backstage/frontend-plugin-api';
import DashboardIcon from '@material-ui/icons/Dashboard';

const catalogRouteRef = createRouteRef();
const screenSpaceRouteRef = createRouteRef();
const projectControlRouteRef = createRouteRef();
const controlAssetsRouteRef = createRouteRef();
const actorProcessControlRouteRef = createRouteRef();
const designAssetControlRouteRef = createRouteRef();
const identityAdministrationRouteRef = createRouteRef();

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

const controlAssetsPage = PageBlueprint.make({
  name: 'control-assets',
  params: {
    routeRef: controlAssetsRouteRef,
    path: '/resonance-control-assets',
    title: 'Resonance 운영·설계·개발',
    icon: <DashboardIcon />,
    loader: () =>
      import('./ResonanceControlAssetsPage').then(module => (
        <module.ResonanceControlAssetsPage />
      )),
  },
});

const actorProcessControlPage = PageBlueprint.make({
  name: 'actor-process-control',
  params: {
    routeRef: actorProcessControlRouteRef,
    path: '/actor-process-control',
    title: 'Actor·Process 프로젝트 제어',
    icon: <DashboardIcon />,
    loader: () =>
      import('./ActorProcessControlPage').then(module => (
        <module.ActorProcessControlPage />
      )),
  },
});

const designAssetControlPage = PageBlueprint.make({
  name: 'design-asset-control',
  params: {
    routeRef: designAssetControlRouteRef,
    path: '/design-assets',
    title: '공통 디자인 자산 관리',
    icon: <DashboardIcon />,
    loader: () =>
      import('./DesignAssetControlPage').then(module => (
        <module.DesignAssetControlPage />
      )),
  },
});

const identityAdministrationPage = PageBlueprint.make({
  name: 'identity-administration',
  params: {
    routeRef: identityAdministrationRouteRef,
    path: '/identity-administration',
    title: 'Resonance 통합계정 관리',
    icon: <DashboardIcon />,
    loader: () =>
      import('./IdentityAdministrationPage').then(module => (
        <module.IdentityAdministrationPage />
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
    controlAssets: controlAssetsRouteRef,
    actorProcessControl: actorProcessControlRouteRef,
    designAssetControl: designAssetControlRouteRef,
    identityAdministration: identityAdministrationRouteRef,
  },
  extensions: [
    screenDesignsPage,
    screenSpacePage,
    projectControlPage,
    controlAssetsPage,
    actorProcessControlPage,
    designAssetControlPage,
    identityAdministrationPage,
  ],
});

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
const actorProcessDesignRouteRef = createRouteRef();
const actorProcessDevelopmentRouteRef = createRouteRef();
const actorProcessOperationsRouteRef = createRouteRef();
const designAssetControlRouteRef = createRouteRef();
const identityAdministrationRouteRef = createRouteRef();
const systemOperationsRouteRef = createRouteRef();
const systemDevelopmentRouteRef = createRouteRef();
const systemSecurityRouteRef = createRouteRef();
const migrationCutoverRouteRef = createRouteRef();
const systemRecoveryRouteRef = createRouteRef();

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
      import('./ScreenSpaceRuntimePage').then(module => (
        <module.ScreenSpaceRuntimePage />
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

const actorProcessDesignPage = PageBlueprint.make({
  name: 'actor-process-design',
  params: {
    routeRef: actorProcessDesignRouteRef,
    path: '/actor-process-design',
    title: 'Actor·Process 설계',
    icon: <DashboardIcon />,
    loader: () =>
      import('./ActorProcessControlPage').then(module => (
        <module.ActorProcessControlPage initialWorkspaceId="design" />
      )),
  },
});

const actorProcessDevelopmentPage = PageBlueprint.make({
  name: 'actor-process-development',
  params: {
    routeRef: actorProcessDevelopmentRouteRef,
    path: '/actor-process-development',
    title: 'Actor·Process 개발',
    icon: <DashboardIcon />,
    loader: () =>
      import('./ActorProcessControlPage').then(module => (
        <module.ActorProcessControlPage initialWorkspaceId="delivery" />
      )),
  },
});

const actorProcessOperationsPage = PageBlueprint.make({
  name: 'actor-process-operations',
  params: {
    routeRef: actorProcessOperationsRouteRef,
    path: '/actor-process-operations',
    title: 'Actor·Process 운영',
    icon: <DashboardIcon />,
    loader: () =>
      import('./ActorProcessControlPage').then(module => (
        <module.ActorProcessControlPage initialWorkspaceId="operate" />
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

const systemOperationsPage = PageBlueprint.make({
  name: 'system-operations',
  params: {
    routeRef: systemOperationsRouteRef,
    path: '/system-operations',
    title: '시스템 운영 관제',
    icon: <DashboardIcon />,
    loader: () =>
      import('./SystemOperationsControlPage').then(module => (
        <module.SystemOperationsControlPage />
      )),
  },
});

const systemDevelopmentPage = PageBlueprint.make({
  name: 'system-development',
  params: {
    routeRef: systemDevelopmentRouteRef,
    path: '/system-development',
    title: '개발 자산 제어',
    icon: <DashboardIcon />,
    loader: () =>
      import('./SystemDevelopmentControlPage').then(module => (
        <module.SystemDevelopmentControlPage />
      )),
  },
});

const systemSecurityPage = PageBlueprint.make({
  name: 'system-security',
  params: {
    routeRef: systemSecurityRouteRef,
    path: '/system-security',
    title: '보안·권한 관제',
    icon: <DashboardIcon />,
    loader: () =>
      import('./SystemSecurityControlPage').then(module => (
        <module.SystemSecurityControlPage />
      )),
  },
});

const migrationCutoverPage = PageBlueprint.make({
  name: 'migration-cutover',
  params: {
    routeRef: migrationCutoverRouteRef,
    path: '/migration-cutover',
    title: 'Resonance 이관 대장',
    icon: <DashboardIcon />,
    loader: () =>
      import('./MigrationCutoverPage').then(module => (
        <module.MigrationCutoverPage />
      )),
  },
});

const systemRecoveryPage = PageBlueprint.make({
  name: 'system-recovery',
  params: {
    routeRef: systemRecoveryRouteRef,
    path: '/system-recovery',
    title: '시스템 백업·복구 제어',
    icon: <DashboardIcon />,
    loader: () =>
      import('./SystemRecoveryControlPage').then(module => (
        <module.SystemRecoveryControlPage />
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
    actorProcessDesign: actorProcessDesignRouteRef,
    actorProcessDevelopment: actorProcessDevelopmentRouteRef,
    actorProcessOperations: actorProcessOperationsRouteRef,
    designAssetControl: designAssetControlRouteRef,
    identityAdministration: identityAdministrationRouteRef,
    systemOperations: systemOperationsRouteRef,
    systemDevelopment: systemDevelopmentRouteRef,
    systemSecurity: systemSecurityRouteRef,
    migrationCutover: migrationCutoverRouteRef,
    systemRecovery: systemRecoveryRouteRef,
  },
  extensions: [
    screenDesignsPage,
    screenSpacePage,
    projectControlPage,
    controlAssetsPage,
    actorProcessControlPage,
    actorProcessDesignPage,
    actorProcessDevelopmentPage,
    actorProcessOperationsPage,
    designAssetControlPage,
    identityAdministrationPage,
    systemOperationsPage,
    systemDevelopmentPage,
    systemSecurityPage,
    migrationCutoverPage,
    systemRecoveryPage,
  ],
});

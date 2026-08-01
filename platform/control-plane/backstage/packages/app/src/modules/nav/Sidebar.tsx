import {
  Sidebar,
  SidebarDivider,
  SidebarGroup,
  SidebarItem,
  SidebarScrollWrapper,
  SidebarSpace,
} from '@backstage/core-components';
import { NavContentBlueprint } from '@backstage/plugin-app-react';
import { SidebarLogo } from './SidebarLogo';
import MenuIcon from '@material-ui/icons/Menu';
import SearchIcon from '@material-ui/icons/Search';
import { SidebarSearchModal } from '@backstage/plugin-search';
import { UserSettingsSignInAvatar } from '@backstage/plugin-user-settings';
import { NotificationsSidebarItem } from '@backstage/plugin-notifications';
import { fetchApiRef, useApi } from '@backstage/core-plugin-api';
import { useEffect, useState } from 'react';
import DashboardIcon from '@material-ui/icons/Dashboard';

type ProjectSummary = { projectId: string; projectName: string };

function ProjectSwitcher() {
  const fetchApi = useApi(fetchApiRef);
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [projectId, setProjectId] = useState(
    () =>
      window.localStorage.getItem('resonance.selectedProjectId') ??
      'CCUS-PLATFORM',
  );

  useEffect(() => {
    fetchApi
      .fetch('/api/resonance-projects')
      .then(response =>
        response.ok
          ? response.json()
          : Promise.reject(new Error(String(response.status))),
      )
      .then((payload: { projects?: ProjectSummary[] }) =>
        setProjects(payload.projects ?? []),
      )
      .catch(() => setProjects([]));
  }, [fetchApi]);

  return (
    <div style={{ padding: '8px 12px 10px' }}>
      <label
        htmlFor="resonance-project-switcher"
        style={{ display: 'block', fontSize: 11, marginBottom: 4 }}
      >
        현재 프로젝트
      </label>
      <select
        id="resonance-project-switcher"
        aria-label="현재 프로젝트 선택"
        value={projectId}
        onChange={event => {
          const next = event.target.value;
          setProjectId(next);
          window.localStorage.setItem('resonance.selectedProjectId', next);
          window.dispatchEvent(
            new CustomEvent('resonance-project-changed', { detail: next }),
          );
        }}
        style={{
          width: '100%',
          minHeight: 34,
          borderRadius: 4,
          padding: '4px 6px',
        }}
      >
        {projects.map(project => (
          <option key={project.projectId} value={project.projectId}>
            {project.projectName} ({project.projectId})
          </option>
        ))}
      </select>
    </div>
  );
}

export const SidebarContent = NavContentBlueprint.make({
  params: {
    component: ({ navItems }) => {
      const nav = navItems.withComponent(item => (
        <SidebarItem icon={() => item.icon} to={item.href} text={item.title} />
      ));

      // Skipped items
      nav.take('page:search'); // Using search modal instead
      nav.take('page:notifications'); // Using NotificationsSidebarItem manually instead

      return (
        <Sidebar>
          <SidebarLogo />
          <ProjectSwitcher />
          <SidebarGroup label="Search" icon={<SearchIcon />} to="/search">
            <SidebarSearchModal />
          </SidebarGroup>
          <SidebarDivider />
          <SidebarGroup label="Menu" icon={<MenuIcon />}>
            {nav.take('page:catalog')}
            {nav.take('page:scaffolder')}
            <SidebarDivider />
            <SidebarGroup
              label="프로젝트 작업공간"
              icon={<DashboardIcon />}
              to="/resonance-projects"
            >
              {nav.take('page:ccus-screen-designs/project-control')}
              {nav.take('page:ccus-screen-designs/actor-process-control')}
              {nav.take('page:ccus-screen-designs/actor-process-design')}
              {nav.take('page:ccus-screen-designs/actor-process-development')}
              {nav.take('page:ccus-screen-designs/actor-process-operations')}
              {nav.take('page:ccus-screen-designs/control-assets')}
              {nav.take('page:ccus-screen-designs/design-asset-control')}
              {nav.take('page:ccus-screen-designs/screen-space')}
              {nav.take('page:ccus-screen-designs')}
            </SidebarGroup>
            <SidebarDivider />
            <SidebarScrollWrapper>
              {nav.rest({ sortBy: 'title' })}
            </SidebarScrollWrapper>
          </SidebarGroup>
          <SidebarSpace />
          <SidebarDivider />
          <NotificationsSidebarItem />
          <SidebarDivider />
          <SidebarGroup
            label="Settings"
            icon={<UserSettingsSignInAvatar />}
            to="/settings"
          >
            {nav.take('page:app-visualizer')}
            {nav.take('page:user-settings')}
          </SidebarGroup>
        </Sidebar>
      );
    },
  },
});

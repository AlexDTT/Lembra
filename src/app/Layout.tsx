import { Suspense, useEffect, useId, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import {
  Avatar,
  BottomNavigation,
  BottomNavigationAction,
  Button as MuiButton,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Divider,
} from '@mui/material';
import { useI18n } from '../i18n/context';
import { useAuth } from './auth-context';
import { Banner, Button, Spinner } from '../components/ui';
import { useOnline } from '../lib/network';
import { Icon } from '../components/Icon';
import { Brand } from '../components/Brand';
import { useCopy } from '../i18n/ux';
import { useIntegrations } from '../features/settings/integrations';
const nav = [
  ['/', 'today', 'home'],
  ['/medications', 'medications', 'pill'],
  ['/tasks', 'tasks', 'check'],
  ['/calendar', 'calendar', 'calendar'],
  ['/money', 'money', 'wallet'],
] as const;
const secondaryNav = [
  ['/family', 'familyView', 'shield'],
  ['/settings', 'settings', 'settings'],
] as const;
const mobileNav = [
  ['/', 'today', 'home'],
  ['/medications', 'medications', 'pill'],
  ['/calendar', 'calendar', 'calendar'],
  ['/money', 'mobileMoney', 'wallet'],
] as const;
export function Layout() {
  const { t } = useI18n();
  const copy = useCopy();
  const online = useOnline();
  const { tokenError, signIn, signOut, session } = useAuth();
  const [accountAnchor, setAccountAnchor] = useState<HTMLElement | null>(null);
  const accountMenuId = useId();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState(false);
  const logout = async () => {
    setSigningOut(true);
    setSignOutError(false);
    try {
      await signOut();
    } catch {
      setSignOutError(true);
    } finally {
      setSigningOut(false);
    }
  };
  const integrations = useIntegrations();
  const { pathname } = useLocation();
  const [drawer, setDrawer] = useState(false);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const navigation = (
    <>
      <Link className="brand-link" to="/" onClick={() => setDrawer(false)}>
        <Brand compact />
      </Link>
      <MuiButton
        className="sidebar-add"
        component={Link}
        to="/add"
        variant="contained"
        startIcon={<Icon name="plus" />}
        onClick={() => setDrawer(false)}
      >
        {t('add')}
      </MuiButton>
      <List
        component="nav"
        aria-label={copy.navigation}
        className="app-nav primary-nav"
      >
        {nav.map(([to, label, icon]) => {
          const active =
            to === '/'
              ? pathname === '/'
              : pathname.startsWith(to) ||
                (to === '/calendar' && pathname.startsWith('/appointments')) ||
                (to === '/money' && pathname.startsWith('/bills'));
          return (
            <ListItemButton
              component={Link}
              to={to}
              aria-current={active ? 'page' : undefined}
              className={active ? 'active' : ''}
              key={to}
              onClick={() => setDrawer(false)}
            >
              <ListItemIcon>
                <Icon name={icon} />
              </ListItemIcon>
              <ListItemText primary={t(label)} />
            </ListItemButton>
          );
        })}
      </List>
      <List
        component="nav"
        aria-label={copy.secondaryNavigation}
        className="app-nav secondary-nav"
      >
        {secondaryNav.map(([to, label, icon]) => (
          <ListItemButton
            component={Link}
            to={to}
            aria-current={pathname.startsWith(to) ? 'page' : undefined}
            className={pathname.startsWith(to) ? 'active' : ''}
            key={to}
            onClick={() => setDrawer(false)}
          >
            <ListItemIcon>
              <Icon name={icon} />
            </ListItemIcon>
            <ListItemText primary={t(label)} />
          </ListItemButton>
        ))}
      </List>
    </>
  );
  const accountControls = (
    <div className="sidebar-bottom">
      <MuiButton
        className="account-menu-trigger"
        aria-label={copy.profile}
        fullWidth
        disabled={signingOut}
        aria-controls={accountAnchor ? accountMenuId : undefined}
        aria-haspopup="menu"
        aria-expanded={!!accountAnchor}
        onClick={(event) => setAccountAnchor(event.currentTarget)}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            bgcolor: '#e6f3ed',
            color: 'primary.main',
          }}
        >
          {session?.user.email?.charAt(0).toUpperCase()}
        </Avatar>
        <span>{copy.profile}</span>
        <Icon name="chevron" size={18} />
      </MuiButton>
    </div>
  );
  const accountInHeader = !!accountAnchor?.closest('.mobile-header');
  const activeMobile = mobileNav.findIndex(([to]) =>
    to === '/'
      ? pathname === '/'
      : pathname.startsWith(to) ||
        (to === '/calendar' && pathname.startsWith('/appointments')) ||
        (to === '/money' && pathname.startsWith('/bills')),
  );
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        {t('skipLink')}
      </a>
      <aside className="sidebar">
        {navigation}
        {accountControls}
      </aside>
      <Drawer
        open={drawer}
        onClose={() => setDrawer(false)}
        className="mobile-drawer"
        slotProps={{
          paper: {
            role: 'dialog',
            'aria-label': copy.navigation,
            sx: {
              width: 290,
              maxWidth: 'calc(100vw - 16px)',
              p: 2,
              overflow: 'hidden',
            },
          },
        }}
      >
        <div className="drawer-close">
          <IconButton aria-label={t('close')} onClick={() => setDrawer(false)}>
            <Icon name="close" />
          </IconButton>
        </div>
        <div className="drawer-navigation">{navigation}</div>
        {accountControls}
      </Drawer>
      <Menu
        id={accountMenuId}
        anchorEl={accountAnchor}
        open={!!accountAnchor}
        onClose={() => setAccountAnchor(null)}
        anchorOrigin={{
          vertical: accountInHeader ? 'bottom' : 'top',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: accountInHeader ? 'top' : 'bottom',
          horizontal: 'right',
        }}
      >
        <div className="account-menu-details">
          <strong>{copy.profile}</strong>
          <small>{session?.user.email}</small>
        </div>
        <Divider />
        <MenuItem
          component={Link}
          to="/settings"
          onClick={() => {
            setAccountAnchor(null);
            setDrawer(false);
          }}
        >
          <ListItemIcon>
            <Icon name="settings" size={20} />
          </ListItemIcon>
          {t('settings')}
        </MenuItem>
        <MenuItem
          disabled={signingOut}
          onClick={() => {
            setAccountAnchor(null);
            void logout();
          }}
        >
          <ListItemIcon>
            <Icon name="logout" size={20} />
          </ListItemIcon>
          {t('signOut')}
        </MenuItem>
      </Menu>
      <div className="app-main">
        <header className="mobile-header">
          <IconButton
            className="mobile-menu-button"
            aria-label={copy.openNavigation}
            aria-expanded={drawer}
            aria-haspopup="dialog"
            onClick={() => setDrawer(true)}
          >
            <Icon name="menu" size={26} />
          </IconButton>
          <Link className="brand-link" to="/">
            <Brand compact />
          </Link>
          <IconButton
            className="mobile-account-button"
            aria-label={copy.profile}
            disabled={signingOut}
            aria-controls={accountAnchor ? accountMenuId : undefined}
            aria-haspopup="menu"
            aria-expanded={!!accountAnchor}
            onClick={(event) => setAccountAnchor(event.currentTarget)}
          >
            <Avatar
              sx={{
                width: 32,
                height: 32,
                bgcolor: '#e6f3ed',
                color: 'primary.main',
              }}
            >
              {session?.user.email?.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>
        </header>
        <main id="main-content" className="content" key={pathname}>
          {signOutError && <Banner alert>{t('actionError')}</Banner>}
          {integrations.data?.google_error && (
            <Banner alert>
              {t('syncError')} <Link to="/settings">{t('reconnect')}</Link>
            </Banner>
          )}
          {!online && <Banner>{t('offline')}</Banner>}
          {'Notification' in window && Notification.permission === 'denied' && (
            <Banner>
              {t('pushDenied')} <Link to="/settings">{t('settings')}</Link>
            </Banner>
          )}
          {tokenError && (
            <Banner alert>
              {t('tokenError')}{' '}
              <Button
                variant="secondary"
                onClick={() => {
                  void signIn().catch(() => {});
                }}
              >
                {t('reconnect')}
              </Button>
            </Banner>
          )}
          <Suspense fallback={<Spinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <BottomNavigation
        showLabels
        value={activeMobile}
        className="mobile-bottom-nav"
      >
        {mobileNav.map(([to, label, icon]) => (
          <BottomNavigationAction
            key={to}
            component={Link}
            to={to}
            label={t(label)}
            icon={<Icon name={icon} />}
          />
        ))}
        <BottomNavigationAction
          label={copy.more}
          aria-expanded={drawer}
          aria-haspopup="dialog"
          icon={<Icon name="menu" />}
          onClick={() => setDrawer(true)}
        />
      </BottomNavigation>
    </div>
  );
}

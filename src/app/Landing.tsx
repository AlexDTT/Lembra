import { Link } from 'react-router-dom';
import { Button, Chip } from '@mui/material';
import { Brand } from '../components/Brand';
import { Icon } from '../components/Icon';
import { useI18n } from '../i18n/context';
import { useCopy } from '../i18n/ux';
import { useAuth } from './auth-context';

export function Landing() {
  const copy = useCopy();
  const { t, locale, setLocale } = useI18n();
  const { session } = useAuth();
  const destination = session ? '/' : '/login';
  const features = [
    ['pill', t('medications'), copy.medicationHelp],
    ['calendar', t('appointments'), copy.appointmentHelp],
    ['receipt', t('bills'), copy.billHelp],
    ['wallet', t('money'), copy.moneyHelp],
  ] as const;
  return (
    <div className="landing">
      <a href="#main-content" className="skip-link">
        {t('skipLink')}
      </a>
      <header className="landing-nav">
        <Link to="/welcome" aria-label="Lembra">
          <Brand compact />
        </Link>
        <div className="actions">
          <Button
            variant="text"
            onClick={() => setLocale(locale === 'en' ? 'pt-PT' : 'en')}
            aria-label={t('language')}
          >
            {locale === 'en' ? 'PT' : 'EN'}
          </Button>
          <Button component={Link} to={destination} variant="outlined">
            {session ? t('today') : locale === 'en' ? 'Sign in' : 'Entrar'}
          </Button>
        </div>
      </header>
      <main id="main-content">
        <section className="landing-hero">
          <div className="hero-copy">
            <h1>
              {copy.hero}
              <br />
              <span>{copy.heroAccent}</span>
            </h1>
            <p>{copy.heroHelp}</p>
            <div className="actions">
              <Button
                variant="contained"
                component={Link}
                to={destination}
                endIcon={<Icon name="arrow" />}
              >
                {copy.enter}
              </Button>
              <Button component="a" href="#features" variant="text">
                {copy.discover}
              </Button>
            </div>
            <p className="invitation">
              <Icon name="shield" size={16} />
              {copy.invitation}
            </p>
          </div>
          <div className="hero-visual">
            <div className="hero-orbit" aria-hidden="true" />
            <div className="day-preview">
              <div className="preview-heading">
                <Brand compact />
                <Chip label={copy.preview} size="small" />
              </div>
              <p className="eyebrow">{copy.previewDate}</p>
              <h2>
                {t('today')}
                <span className="preview-sun">
                  <Icon name="sun" size={30} />
                </span>
              </h2>
              <p>{copy.dailyHelp}</p>
              <div className="preview-task">
                <span className="preview-icon">
                  <Icon name="pill" />
                </span>
                <div>
                  <span>08:00</span>
                  <strong>{copy.previewMedication}</strong>
                  <small>{copy.previewDose}</small>
                </div>
                <span className="preview-check">
                  <Icon name="check" size={18} />
                </span>
              </div>
              <div className="preview-task">
                <span className="preview-icon peach">
                  <Icon name="calendar" />
                </span>
                <div>
                  <span>14:30</span>
                  <strong>{copy.previewAppointment}</strong>
                  <small>{t('appointments')}</small>
                </div>
              </div>
              <div className="preview-task">
                <span className="preview-icon gold">
                  <Icon name="receipt" />
                </span>
                <div>
                  <span>{t('dueToday')}</span>
                  <strong>{copy.previewBill}</strong>
                  <small>€ 42,50</small>
                </div>
              </div>
              <div className="preview-footer">
                <Icon name="check" size={18} />
                {copy.stepThree}
              </div>
            </div>
            <div className="floating-note">
              <span>
                <Icon name="bell" />
              </span>
              <div>
                <strong>{t('reminderSettings')}</strong>
                <small>{copy.stepTwo}</small>
              </div>
            </div>
          </div>
        </section>
        <section className="landing-section" id="features">
          <p className="eyebrow">
            {locale === 'en' ? 'LEMBRA, EVERY DAY' : 'LEMBRA, TODOS OS DIAS'}
          </p>
          <h2>{copy.features}</h2>
          <p className="section-description">{copy.featuresHelp}</p>
          <div className="feature-grid">
            {features.map(([icon, title, help], index) => (
              <article className="feature-card" key={icon}>
                <span className={`feature-icon tone-${index}`}>
                  <Icon name={icon} size={28} />
                </span>
                <h3>{title}</h3>
                <p>{help}</p>
              </article>
            ))}
          </div>
        </section>
        <section className="landing-section how-section">
          <div>
            <p className="eyebrow">{t('organize')}</p>
            <h2>{copy.how}</h2>
          </div>
          <div className="steps">
            {[
              [copy.stepOne, copy.stepOneHelp],
              [copy.stepTwo, copy.stepTwoHelp],
              [copy.stepThree, copy.stepThreeHelp],
            ].map(([title, help], index) => (
              <article key={title}>
                <span className="step-number">0{index + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{help}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="privacy-section">
          <span className="privacy-icon">
            <Icon name="shield" size={36} />
          </span>
          <div>
            <h2>{copy.privateTitle}</h2>
            <p>{copy.privateHelp}</p>
          </div>
        </section>
        <section className="landing-cta">
          <h2>{copy.finalTitle}</h2>
          <p>{copy.finalHelp}</p>
          <Button
            variant="contained"
            component={Link}
            to={destination}
            endIcon={<Icon name="arrow" />}
          >
            {copy.enter}
          </Button>
          <p className="invitation">{copy.invitation}</p>
        </section>
      </main>
      <footer className="landing-footer">
        <Brand compact />
        <small>© {new Date().getFullYear()} Lembra</small>
      </footer>
    </div>
  );
}

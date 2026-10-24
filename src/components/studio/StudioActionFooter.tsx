import { useLanguage } from '../../locales';
import type { BatchRenderProgress, RenderSettings, ViralClip } from '../../types';

interface StudioActionFooterProps {
  isRendering: boolean;
  selectedClips: ViralClip[];
  batchProgress: BatchRenderProgress | null;
  renderMode: RenderSettings['renderMode'];
  totalSelectedDuration: number;
  allowAppUpdates: boolean;
  isClearingTemp: boolean;
  tempClearMsg: string;
  handleClearTempClick: () => void;
  hasCookies: boolean;
  isYouTube: boolean;
  onOpenCookiesModal?: () => void;
  handleLaunch: () => void;
}

/** Sticky action bar with the primary render CTA. */
export function StudioActionFooter({
  isRendering,
  selectedClips,
  batchProgress,
  renderMode,
  totalSelectedDuration,
  allowAppUpdates,
  isClearingTemp,
  tempClearMsg,
  handleClearTempClick,
  hasCookies,
  isYouTube,
  onOpenCookiesModal,
  handleLaunch,
}: StudioActionFooterProps) {
  const { t } = useLanguage();

  return (
      <div className="studio-bottom-action-bar">
        <div className="action-bar-meta">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="meta-badge">
              {t.studio.readyToRenderMeta(selectedClips.length)}
            </span>
            {allowAppUpdates && (
              <>
                <button
                  type="button"
                  className="studio-clear-temp-btn"
                  title={t.studio.clearTempTooltip}
                  onClick={handleClearTempClick}
                  disabled={isClearingTemp}
                  style={{
                    background: 'rgba(255, 255, 255, 0.07)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    color: 'var(--text-secondary)',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '0.2rem 0.55rem',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isClearingTemp ? t.studio.clearingTempBtn : t.studio.clearTempBtn}
                </button>
                {tempClearMsg && (
                  <span style={{ fontSize: '0.72rem', color: '#4ade80', fontWeight: 600 }}>
                    {tempClearMsg}
                  </span>
                )}
              </>
            )}
          </div>
          <span className="meta-sub">
            {t.studio.outputMetaSub}
          </span>
        </div>

        {!hasCookies && isYouTube && (
          <div
            className="studio-cookie-warning-banner"
            onClick={onOpenCookiesModal}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '0.75rem',
              padding: '0.7rem 1.1rem',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.06) 100%)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              cursor: onOpenCookiesModal ? 'pointer' : 'default',
              margin: '0.65rem 0',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', textAlign: 'left' }}>
              <span style={{ fontSize: '1.15rem' }}>[!]</span>
              <span style={{ fontSize: '0.79rem', color: '#fbbf24', fontWeight: 500, lineHeight: 1.4 }}>
                {t.cookieWarning.studioBannerWarning}
              </span>
            </div>
            {onOpenCookiesModal && (
              <span
                style={{
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  color: '#34d399',
                  background: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.35)',
                  padding: '0.25rem 0.65rem',
                  borderRadius: '6px',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {t.cookieWarning.studioBannerAction} →
              </span>
            )}
          </div>
        )}

        <button
          className="studio-btn-render glowing-btn big-render-cta"
          onClick={handleLaunch}
          disabled={isRendering || batchProgress?.overall_status === 'running' || selectedClips.length === 0}
        >
          {batchProgress?.overall_status === 'running' ? (
            <>{t.studio.renderingInProgressBadge}</>
          ) : isRendering ? (
            <>{t.studio.launchingRenderBtn}</>
          ) : selectedClips.length === 0 ? (
            <>{t.studio.selectClipWarning}</>
          ) : renderMode === 'merged' ? (
            <>{t.studio.mergedRenderCta(selectedClips.length, totalSelectedDuration)}</>
          ) : (
            <>
              {t.studio.batchRenderCta(selectedClips.length)}
            </>
          )}
        </button>
      </div>

  );
}

import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Button, message } from "antd";
import { ModelDataView } from "./ModelDataView";
import { TextView } from "./TextView";
import { LogicView } from "./LogicView";
import SimulateView from "./SimulateView";
import SampleArt from "./SampleArt";
import useAppStore from "../../store/store";
import useDesignV2Store from "../../store/designV2Store";
import { usePickTemplate } from "./usePickTemplate";
import { agreementText, buildTemplateArchive, downloadAgreementPdf, saveFile, templateArchiveName } from "./deployActions";
import { STEP_KEY, type DesignV2View } from "../../types/designV2.types";
import {
  ROUTES,
  WELCOME,
  START,
  START_SAMPLES,
  DEPLOY,
  type DeployActionKey,
  type StartSample,
} from "./constants";

/*
 * Welcome hero, template gallery and the Deploy step. Each is swapped in by
 * DesignV2Layout based on `view`; the editor steps live in their own files.
 */

interface WelcomeViewProps {
  onStart: () => void;
}

/**
 * Dark hero card: Accord Project wordmark, headline and the two CTAs.
 */
export const WelcomeView = ({ onStart }: WelcomeViewProps) => {
  const navigate = useNavigate();
  return (
  <div className="nd-view nd-view-welcome">
    <div className="nd-hero">
      <div className="nd-hero-grid" />
      <img className="nd-hero-logo" src={WELCOME.logoSrc} alt={WELCOME.logoAlt} />
      <div className="nd-spacer" />
      <h1 className="nd-hero-title">
        {WELCOME.titleLine}
        <br />
        <span className="nd-hero-title-accent">{WELCOME.titleAccent}</span>
      </h1>
      <p className="nd-hero-sub">
        {WELCOME.subtitleLine1}
        <br />
        {WELCOME.subtitleLine2}
      </p>
      <div className="nd-hero-actions">
        <Button type="primary" size="large" shape="round" onClick={onStart}>
          {WELCOME.start} →
        </Button>
        <Button ghost size="large" shape="round" onClick={() => navigate(ROUTES.learnIntro)}>{WELCOME.howItWorks}</Button>
      </div>
      <div className="nd-spacer" />
    </div>
  </div>
  );
};

interface SampleCardProps {
  sample: StartSample;
  /** The card's template is the one currently loaded (e.g. after Back from a later step). */
  current: boolean;
  onOpen: () => void;
}

/**
 * One gallery card: an illustration on top; name, tagline, a short list
 * of what the template demonstrates and its own "Start with this template"
 * button underneath. Nothing else on the card is clickable — picking and
 * opening a template is one click.
 */
const SampleCard = ({ sample, current, onOpen }: SampleCardProps) => {
  const classes = [
    "nd-sample-card",
    `nd-sample-card-${sample.accent}`,
    current ? "nd-sample-card-current" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <article className={classes} aria-current={current ? "true" : undefined} aria-label={sample.name}>
      <div className="nd-sample-art">
        <SampleArt kind={sample.art} />
      </div>
      <div className="nd-sample-foot">
        <div className="nd-sample-foot-row">
          <span className="nd-sample-name">{sample.name}</span>
          {current && <span className="nd-sample-current">{START.current}</span>}
        </div>
        <p className="nd-sample-tagline">{sample.tagline}</p>
        <ul className="nd-sample-learn" aria-label={START.learnLabel(sample.name)}>
          {sample.demonstrates.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
        <Button
          type="primary"
          block
          className="nd-sample-open"
          aria-label={START.openLabel(sample.name)}
          onClick={onOpen}
        >
          {START.open}
        </Button>
      </div>
    </article>
  );
};

/**
 * "Choose a template" gallery: a curated set of cards, each opening the flow
 * on its template in one click. "+ Start blank" does the same with the empty template.
 */
export const StartView = () => {
  const selectedTemplate = useDesignV2Store((s) => s.selectedTemplate);
  const goNext = useDesignV2Store((s) => s.goNext);
  const pick = usePickTemplate();
  const open = (name: string) => {
    pick(name);
    goNext();
  };

  return (
    <div className="nd-view nd-view-start">
      <div className="nd-start-head">
        <span className="nd-start-title">{START.title}</span>
        <span className="nd-start-hint">{START.hint}</span>
        <div className="nd-spacer" />
        <Button type="dashed" size="small" onClick={() => open(START.blankName)}>
          {START.blank}
        </Button>
      </div>
      <div className="nd-sample-grid">
        {START_SAMPLES.map((sample) => (
          <SampleCard
            key={sample.name}
            sample={sample}
            current={selectedTemplate === sample.name}
            onOpen={() => open(sample.name)}
          />
        ))}
      </div>
    </div>
  );
};

/**
 * Step 6: Deploy — one card per way out of the Playground, each with a line
 * on what it does. Action cards work right here (PDF, share link, agreement
 * text, .cta archive — see deployActions.ts); link cards open the docs in a
 * new tab and say so with ↗. One action runs at a time.
 */
export const DeployView = () => {
  const agreementHtml = useAppStore((s) => s.agreementHtml);
  const templateMarkdown = useAppStore((s) => s.templateMarkdown);
  const modelCto = useAppStore((s) => s.modelCto);
  const data = useAppStore((s) => s.data);
  const logicTs = useAppStore((s) => s.logicTs);
  const sampleName = useAppStore((s) => s.sampleName);
  const generateShareableLink = useAppStore((s) => s.generateShareableLink);
  const selectedTemplate = useDesignV2Store((s) => s.selectedTemplate);
  const [busy, setBusy] = useState<DeployActionKey | null>(null);
  const name = selectedTemplate ?? sampleName;

  const copy = async (text: string, done: string) => {
    if (!navigator.clipboard) throw new Error("clipboard unavailable");
    await navigator.clipboard.writeText(text);
    void message.success(done);
  };
  const actions: Record<DeployActionKey, () => Promise<void>> = {
    pdf: () => downloadAgreementPdf(agreementHtml),
    share: () => copy(generateShareableLink(), DEPLOY.done.share),
    copy: () => copy(agreementText(agreementHtml), DEPLOY.done.copy),
    archive: async () => {
      const file = templateArchiveName(name);
      saveFile(await buildTemplateArchive({ name, templateMarkdown, modelCto, data, logicTs }), file, "application/zip");
      void message.success(DEPLOY.done.archive(file));
    },
  };
  const run = async (key: DeployActionKey) => {
    setBusy(key);
    try {
      await actions[key]();
    } catch (error) {
      console.error(`Deploy action "${key}" failed:`, error);
      void message.error(DEPLOY.failed[key]);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="nd-view nd-view-export">
      <div className="nd-export-head">
        <h1>{DEPLOY.title}</h1>
        <p className="nd-export-subtitle">{DEPLOY.subtitle}</p>
      </div>
      <div className="nd-export-grid">
        {DEPLOY.cards.map((card) => (
          <article key={card.key} className="nd-card nd-export-card" aria-label={card.title}>
            <span className="nd-export-label">{card.title}</span>
            <p className="nd-export-desc">{card.description}</p>
            <div className="nd-export-actions">
              {"href" in card ? (
                <>
                  <Button href={card.href} target="_blank" rel="noopener noreferrer">
                    {card.action}
                  </Button>
                  {card.more && (
                    <a className="nd-export-more" href={card.more.href} target="_blank" rel="noopener noreferrer">
                      {card.more.label}
                    </a>
                  )}
                </>
              ) : (
                <Button
                  type="primary"
                  ghost
                  loading={busy === card.key}
                  disabled={busy !== null && busy !== card.key}
                  onClick={() => void run(card.key)}
                >
                  {card.action}
                </Button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

interface ViewSwitchProps {
  view: DesignV2View;
  onStart: () => void;
}

export const ViewSwitch = ({ view, onStart }: ViewSwitchProps) => {
  if (view === "welcome") return <WelcomeView onStart={onStart} />;
  const key = STEP_KEY[view];
  if (key === "template") return <StartView />;
  if (key === "modelData") return <ModelDataView />;
  if (key === "text") return <TextView />;
  if (key === "logic") return <LogicView />;
  if (key === "simulate") return <SimulateView />;
  return <DeployView />;
};

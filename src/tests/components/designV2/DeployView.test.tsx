import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import JSZip from 'jszip';
import { DeployView } from '../../../components/designV2/views';
import { DEPLOY, URLS } from '../../../components/designV2/constants';
import { agreementText, buildTemplateArchive, templateArchiveName } from '../../../components/designV2/deployActions';
import useAppStore from '../../../store/store';
import useDesignV2Store from '../../../store/designV2Store';
import * as lease from '../../../samples/nda';
import * as counter from '../../../samples/counterLogic';

// html2pdf renders through a canvas; here it is a chainable stub that records save().
const { savePdf } = vi.hoisted(() => ({ savePdf: vi.fn().mockResolvedValue(undefined) }));
vi.mock('html2pdf.js', () => {
  const worker = { set: () => worker, from: () => worker, save: savePdf };
  return { default: () => worker };
});

const AGREEMENT_HTML =
  '<html><body><div class="document"><h1>Residential Lease</h1>\n<p>Rent of <span class="variable">1,250.00</span> per month.</p></div></body></html>';

/**
 * Covers the Deploy step: every card carries a description and one action;
 * the docs cards are links that open in a new tab; the action cards call
 * into deployActions / the store. The archive builder is tested by reading
 * the zip back.
 */
describe('DeployView', () => {
  const writeText = vi.fn<[text: string], Promise<void>>().mockResolvedValue(undefined);
  const generateShareableLink = vi.fn(() => 'https://playground.test/#data=abc');

  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(navigator, { clipboard: { writeText } });
    useAppStore.setState({
      agreementHtml: AGREEMENT_HTML,
      templateMarkdown: lease.TEMPLATE,
      modelCto: lease.MODEL,
      data: JSON.stringify(lease.DATA, null, 2),
      logicTs: '',
      sampleName: lease.NAME,
      generateShareableLink,
    });
    useDesignV2Store.setState({ selectedTemplate: 'Non-disclosure' });
  });

  const card = (title: string) => within(screen.getByRole('article', { name: title }));

  it('renders every card with its title, its description and one action', () => {
    render(<DeployView />);
    for (const entry of DEPLOY.cards) {
      const c = card(entry.title);
      expect(c.getByText(entry.description)).toBeInTheDocument();
      if ('href' in entry) {
        const link = c.getByRole('link', { name: entry.action });
        expect(link).toHaveAttribute('href', entry.href);
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', 'noopener noreferrer');
        expect(entry.action.endsWith('↗'), entry.title).toBe(true);
      } else {
        expect(c.getByRole('button', { name: entry.action })).toBeInTheDocument();
      }
    }
  });

  it('links the APAP, engine and MCP docs, with the APAP tutorial as a second link', () => {
    render(<DeployView />);
    expect(card('Deploy to an APAP server').getByRole('link', { name: 'Tutorial ↗' })).toHaveAttribute('href', URLS.apapTutorial);
    expect(card('Embed in your app').getByRole('link')).toHaveAttribute('href', URLS.engineDocs);
    expect(card('Deploy to an MCP server').getByRole('link')).toHaveAttribute('href', URLS.apapMcp);
  });

  it('"Share link" copies the link the store generates', async () => {
    render(<DeployView />);
    fireEvent.click(card('Share link').getByRole('button'));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith('https://playground.test/#data=abc'));
    expect(generateShareableLink).toHaveBeenCalled();
  });

  it('"Copy to clipboard" copies the agreement as plain text', async () => {
    render(<DeployView />);
    fireEvent.click(card('Copy to clipboard').getByRole('button'));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const [text] = writeText.mock.calls[0];
    expect(text).toBe(agreementText(AGREEMENT_HTML));
    expect(text).toContain('Residential Lease');
    expect(text).toContain('Rent of 1,250.00 per month.');
    expect(text).not.toContain('<');
  });

  it('"Download PDF" prints the rendered agreement', async () => {
    render(<DeployView />);
    fireEvent.click(card('Download PDF').getByRole('button'));
    await waitFor(() => expect(savePdf).toHaveBeenCalledTimes(1));
    // The off-screen host is gone once the PDF is saved.
    expect(document.body.innerHTML).not.toContain('class="document"');
  });

  describe('"Download template archive"', () => {
    const downloads: string[] = [];
    const revokeObjectURL = vi.fn();
    beforeEach(() => {
      downloads.length = 0;
      revokeObjectURL.mockClear();
      Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:archive'), revokeObjectURL });
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
        downloads.push(this.download);
      });
    });
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('saves a .cta named after the picked template', async () => {
      render(<DeployView />);
      fireEvent.click(card('Download template archive').getByRole('button'));
      await waitFor(() => expect(downloads).toEqual(['non-disclosure.cta']));
      expect(revokeObjectURL).toHaveBeenCalledWith('blob:archive');
    });
  });
});

describe('buildTemplateArchive', () => {
  const read = async (bytes: Uint8Array) => {
    const zip = await JSZip.loadAsync(bytes);
    const files: Record<string, string> = {};
    // zip.files also lists the directories ("model/"); only the files matter here.
    for (const path of Object.keys(zip.files).filter((p) => !zip.files[p].dir)) {
      files[path] = await zip.files[path].async('string');
    }
    return files;
  };

  it('lays the template out the way Accord Project tooling loads it', async () => {
    const files = await read(
      await buildTemplateArchive({
        name: 'Residential Lease',
        templateMarkdown: lease.TEMPLATE,
        modelCto: lease.MODEL,
        data: '{"a":1}',
      })
    );
    expect(Object.keys(files).sort()).toEqual(['data.json', 'model/model.cto', 'package.json', 'text/grammar.tem.md']);
    expect(files['text/grammar.tem.md']).toBe(lease.TEMPLATE);
    expect(files['model/model.cto']).toBe(lease.MODEL);
    expect(files['data.json']).toBe('{"a":1}');
    const pkg = JSON.parse(files['package.json']) as { name: string; accordproject: { template: string } };
    expect(pkg.name).toBe('residential-lease');
    expect(pkg.accordproject.template).toBe('contract');
  });

  it('adds logic/logic.ts when the template has logic', async () => {
    const files = await read(
      await buildTemplateArchive({
        name: counter.NAME,
        templateMarkdown: counter.TEMPLATE,
        modelCto: counter.MODEL,
        data: '{}',
        logicTs: counter.LOGIC,
      })
    );
    expect(files['logic/logic.ts']).toBe(counter.LOGIC);
  });

  it('names the file after the template', () => {
    expect(templateArchiveName('Late Payment Penalty (with Logic)')).toBe('late-payment-penalty-with-logic.cta');
    expect(templateArchiveName('   ')).toBe('template.cta');
  });
});

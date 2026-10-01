import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Maximize, Minus, Plus } from 'lucide-react';
import academicDocumentService from '../../services/academicDocumentService';

export default function AcademicDocumentViewer({ documentId, pages, onDownload }) {
  const [scale, setScale] = useState(1);
  const [activePage, setActivePage] = useState(1);
  const [sources, setSources] = useState({});
  const [pageErrors, setPageErrors] = useState({});
  const pageRefs = useRef(new Map());
  const sourceRefs = useRef(new Set());

  useEffect(() => {
    setSources({});
    setPageErrors({});
    setActivePage(1);
    sourceRefs.current.forEach((url) => URL.revokeObjectURL(url));
    sourceRefs.current.clear();
  }, [documentId, pages]);

  useEffect(() => () => {
    sourceRefs.current.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  useEffect(() => {
    if (!pages.length) return undefined;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
      if (visible) {
        const pageNumber = Number(visible.target.dataset.page);
        setActivePage(pageNumber);
        loadPage(pageNumber);
      }
    }, { rootMargin: '300px 0px', threshold: [0.1, 0.5, 0.9] });
    pageRefs.current.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [pages, sources]);

  const loadPage = async (pageNumber) => {
    if (sources[pageNumber] || pageErrors[pageNumber]) return;
    try {
      const blob = await academicDocumentService.getPage(documentId, pageNumber);
      const url = URL.createObjectURL(blob);
      sourceRefs.current.add(url);
      setSources((current) => ({ ...current, [pageNumber]: url }));
    } catch (error) {
      setPageErrors((current) => ({ ...current, [pageNumber]: error.message || 'Unable to load this page.' }));
    }
  };

  useEffect(() => {
    if (pages[0]) loadPage(pages[0].pageNumber);
  }, [documentId, pages]);

  const jumpToPage = (pageNumber) => pageRefs.current.get(pageNumber)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return <section className="academic-page-viewer" aria-label="Document page viewer">
    <div className="academic-page-toolbar">
      <span>Page {activePage} / {pages.length || 0}</span>
      <div className="academic-page-controls">
        <button className="icon-button" title="Previous page" aria-label="Previous page" disabled={activePage <= 1} onClick={() => jumpToPage(activePage - 1)}><ChevronLeft size={17} /></button>
        <button className="icon-button" title="Next page" aria-label="Next page" disabled={activePage >= pages.length} onClick={() => jumpToPage(activePage + 1)}><ChevronRight size={17} /></button>
        <button className="icon-button" title="Zoom out" aria-label="Zoom out" onClick={() => setScale((value) => Math.max(0.5, value - 0.1))}><Minus size={16} /></button>
        <span>{Math.round(scale * 100)}%</span>
        <button className="icon-button" title="Zoom in" aria-label="Zoom in" onClick={() => setScale((value) => Math.min(2, value + 0.1))}><Plus size={16} /></button>
        <button className="icon-button" title="Fit width" aria-label="Fit width" onClick={() => setScale(1)}><Maximize size={16} /></button>
        <button className="button button-secondary" onClick={onDownload}><Download size={15} />Download PDF</button>
      </div>
    </div>
    <div className="academic-page-stack">
      {pages.map((page) => <article className="academic-page-card" key={page.pageNumber} data-page={page.pageNumber} ref={(element) => { if (element) pageRefs.current.set(page.pageNumber, element); else pageRefs.current.delete(page.pageNumber); }}>
        <header><strong>Page {page.pageNumber}</strong><span>{page.width} × {page.height}px</span></header>
        <div className="academic-page-canvas" style={{ minHeight: Math.min(720, Math.max(260, page.height / 3)), overflowX: 'auto' }}>
          {sources[page.pageNumber] ? <img src={sources[page.pageNumber]} alt={`Page ${page.pageNumber}`} style={{ width: `${scale * 100}%`, maxWidth: 'none', height: 'auto' }} /> : pageErrors[page.pageNumber] ? <p className="form-error">{pageErrors[page.pageNumber]}</p> : <button className="button button-secondary" onClick={() => loadPage(page.pageNumber)}>Load page {page.pageNumber}</button>}
        </div>
      </article>)}
    </div>
  </section>;
}
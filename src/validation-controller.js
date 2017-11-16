const Handlebars = require('handlebars');

const SEVERITY_MAP = ['Errors', 'Warnings', 'Infos', 'Hints'];

const validator = window.gltfValidator;

class ValidationController {
  constructor (el) {
    this.el = el;
    this.report = null;

    this.toggleTpl = Handlebars.compile(document.querySelector('#report-toggle-template').innerHTML);
    this.toggleEl = document.createElement('div');
    this.toggleEl.classList.add('report-toggle-wrap', 'hidden');
    this.el.appendChild(this.toggleEl);

    Handlebars.registerPartial('issuesTable', document.querySelector('#report-table-partial').innerHTML);

    this.reportTpl = Handlebars.compile(document.querySelector('#report-template').innerHTML);
  }

  validate (rootFile, rootPath, fileMap) {
    const rootFileURL = typeof rootFile === 'string'
      ? rootFile
      : URL.createObjectURL(rootFile);

    return fetch(rootFileURL)
      .then((response) => response.arrayBuffer())
      .then((buffer) => validator.validateBytes(new Uint8Array(buffer)))
      .then((report) => this.setReport(report))
      .catch((e) => this.setReportException(e));
  }

  setReport (report) {
    report.issues.maxSeverity = -1;
    SEVERITY_MAP.forEach((severity, index) => {
      if (report.issues[`num${severity}`] > 0 && report.issues.maxSeverity === -1) {
        report.issues.maxSeverity = index;
      }
    });
    report.errors = report.issues.messages.filter((msg) => msg.severity === 0);
    report.warnings = report.issues.messages.filter((msg) => msg.severity === 1);
    report.infos = report.issues.messages.filter((msg) => msg.severity === 2);
    report.hints = report.issues.messages.filter((msg) => msg.severity === 3);
    this.report = report;

    this.toggleEl.innerHTML = this.toggleTpl(report);
    this.showToggle();
    this.bindListeners();
  }

  setReportException (e) {
    this.report = null;
    this.toggleEl.innerHTML = this.toggleTpl({reportError: e, level: 0});
    this.showToggle();
  }

  bindListeners () {
    const reportToggleBtn = this.toggleEl.querySelector('.report-toggle');
    reportToggleBtn.addEventListener('click', () => this.showLightbox());

    const reportToggleCloseBtn = this.toggleEl.querySelector('.report-toggle-close');
    reportToggleCloseBtn.addEventListener('click', (e) => {
      this.hideToggle();
      e.stopPropagation();
    });
  }

  showToggle () {
    this.toggleEl.classList.remove('hidden');
  }

  hideToggle () {
    this.toggleEl.classList.add('hidden');
  }

  showLightbox () {
    if (!this.report) return;
    const tab = window.open('', '_blank');
    tab.document.body.innerHTML = this.reportTpl(Object.assign({}, this.report, {location: location}));
  }
}

module.exports = ValidationController;

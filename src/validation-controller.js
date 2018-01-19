const THREE = require('three');
const Handlebars = require('handlebars');

const SEVERITY_MAP = ['Errors', 'Warnings', 'Infos', 'Hints'];

const validator = window.gltfValidator;

class ValidationController {

  /**
   * @param  {Element} el
   */
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

  /**
   * Runs validation against the given file URL and extra resources.
   * @param  {string} rootFile
   * @param  {string} rootPath
   * @param  {Map<string, File>} assetMap
   * @return {Promise}
   */
  validate (rootFile, rootPath, assetMap) {
    const baseURL = THREE.LoaderUtils.extractUrlBase(rootFile);

    return fetch(rootFile)
      .then((response) => response.arrayBuffer())
      .then((buffer) => validator.validateBytes(new Uint8Array(buffer), {
        externalResourceFunction: (uri) => {

          const normalizedURL = rootPath + uri
            .replace(baseURL, '')
            .replace(/^(\.?\/)/, '');

          return new Promise((resolve, reject) => {
            if (!assetMap.has(normalizedURL)) {
              reject();
              return;
            }
            const file = assetMap.get(normalizedURL);
            const fileURL = URL.createObjectURL(file);
            fetch(fileURL)
              .then((response) => response.arrayBuffer())
              .then((buffer) => {
                resolve(new Uint8Array(buffer));
                URL.revokeObjectURL(fileURL);
              });
          });

        }
      }))
      .then((report) => this.setReport(report))
      .catch((e) => this.setReportException(e));
  }

  /**
   * @param {GLTFValidator.Report} report
   */
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

  /**
   * @param {Error} e
   */
  setReportException (e) {
    this.report = null;
    this.toggleEl.innerHTML = this.toggleTpl({reportError: e, level: 0});
    this.showToggle();
    this.bindListeners();
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

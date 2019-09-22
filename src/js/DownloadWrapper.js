const {shell, ipcRenderer} = require('electron');
const Download = require('./Download.js');
const EventEmitter = require('events');

const {DownloadStatus} = require('./enum');
module.exports = class DownloadWrapper extends EventEmitter {
    constructor(url, parts, customHeaders, proxyOptions, file_name, save_location) {
        super();
        this.last_update = {
            time: 0,
            bytes_progress: 0,
        };

        this.file_name = file_name;
        this.save_location = save_location;
        const download = new Download(url, parts, customHeaders, proxyOptions);
        this.download = download;
        this.failed = false;
        this.status = DownloadStatus.AWAITING;
        const downloadEl = document.createElement('div');
        downloadEl.classList.add('download', 'awaiting');
        downloadEl.innerHTML = `<div class="header">
    <div>
        <span class="progress">0%</span>
        <h2 class="name">${this.file_name}</h2>
    </div>
    <div>
        <button class="tool retry"><i class="fas fa-redo"></i><span class="tool-tip left">Retry Download</span></button>
        <button class="tool remove"><i class="fas fa-trash"></i><span class="tool-tip left">Remove Download From List</span></button>
        <button class="tool show-in-folder"><i class="fas fa-folder"></i><span class="tool-tip left">Show Download in folder</span></button>
        <button class="tool cancel"><i class="fas fa-times"></i><span class="tool-tip left">Cancel Download</span></button>
    </div>
</div>
<div class="download-details" data-enabled>
    <div class="download-detail" data-type="status"><b class="name">Status: </b><span class="value">Awaiting</span></div>
    <div class="download-detail" data-type="source"><b class="name">Source: </b><span class="value">${url}</span></div>
    <div class="download-detail" data-type="final-file"><b class="name">Final File: </b><span class="value"></span></div>
    <div class="download-detail" data-type="headers"><b class="name">Headers: </b><span class="value">${JSON.stringify(customHeaders)}</span></div>
    <div class="download-detail" data-type="error"><b class="name">Error: </b><span class="value">None</span></div>
    <div class="download-detail" data-type="size"><b class="name">Size: </b><span class="value">0.00 B</span></div>
    <div class="download-detail" data-type="elapsed-time"><b class="name">Elapsed Time: </b><span class="value">0</span></div>
    <div class="download-detail" data-type="eta"><b class="name">Estimated Time Of Completion: </b><span class="value">Loading...</span></div>
    <div class="download-detail" data-type="speed"><b class="name">Speed: </b><span class="value">0.00 B/s</span></div>
    <div class="download-detail" data-type="parts-done"><b class="name">Parts Done: </b><span class="value">0 / 0</span></div>
    <div class="download-detail" data-type="progress"><b class="name">Progress: </b><span class="value">0.00 B / 0.00 B (0%)</span></div>
</div>
<div class="progress-bar">
    <div class="progress-bar-wrapper">
        <div class="progress-bar-inner" style="width: 0"></div>
    </div>
</div>`;
        document.querySelector('#queue-downloads').append(downloadEl);
        this.element = downloadEl;
        this.element.querySelector('.retry').addEventListener('click', evt => this.retry());
        this.element.querySelector('.remove').addEventListener('click', evt => {
            this.emit('remove');
            this.element.parentNode.removeChild(this.element)
        });
        this.element.querySelector('.show-in-folder').addEventListener('click', evt => this.showInFolder());
        this.element.querySelector('.cancel').addEventListener('click', evt => this.cancel());

        download
            .on('init-complete', data => this.handleDownloadInit(data))
            .on('update', data => this.handleDownloadUpdate(data))
            .on('parts-done', () => this.handleDownloadFinishing())
            .on('combine-update', (data) => this.handleFileCombineUpdate(data))
            .on('complete', () => this.handleDownloadComplete())
            .on('error', error => this.handleDownloadError(error))
            .on('warn', warning => console.warn(warning));
        download.init(file_name, save_location).then(val => this.emit('startNextDownload'));

    }

    retry() {
        this.download.cancel();
        this.download.init(this.file_name, this.save_location).then(val => this.emit('startNextDownload'));
    }

    showInFolder() {
        shell.showItemInFolder(this.download.final_file);
    }

    cancel() {
        if (this.elapsed_time_interval) {
            clearInterval(this.elapsed_time_interval);
        }
        this.updateStatus(DownloadStatus.STOPPED);
        this.download.cancel();
    }

    start() {
        this.updateStatus(DownloadStatus.ACTIVE);
        this.download.download();
    }


    updateStatus(status_type) {
        this.status = status_type;
        this.element.className = "download " + status_type.toLowerCase();
        this.element.querySelector('.download-detail[data-type=status] .value').innerText = status_type;
    }

    static getActiveDownloads(downloadsArray) {
        return downloadsArray.filter(d => d.status === DownloadStatus.ACTIVE);
    }

    static getReadyDownloads(downloadsArray) {
        return downloadsArray.filter(d => d.status === DownloadStatus.PENDING);
    }

    static bytesToHumanReadable(format, bytes) {
        let output = bytes;
        let steps = 0;

        let units = [];

        if (format === "bin") {
            units = ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB"];

            while (output > 1024) {
                output /= 1024;
                steps++;
            }
        } else if (format === "dec") {
            units = ["B", "KB", "MB", "GB", "TB", "PB", "EB"];

            while (output > 1000) {
                output /= 1000;
                steps++;
            }
        }
        return parseFloat(output).toFixed(2) + " " + units[steps];
    }

    static miliToHumanReadable(milliseconds) {
        const date = new Date(milliseconds);
        return `${date.getUTCHours() || 0}h:${date.getUTCMinutes() || 0}m:${date.getUTCSeconds() || 0}s`;
    }

    handleDownloadInit(data) {
        this.last_update.time = Date.now();
        this.start_time = Date.now();
        this.elapsed_time_interval = setInterval(() => {
            this.element.querySelector('.download-detail[data-type=elapsed-time] .value').innerText = DownloadWrapper.miliToHumanReadable((Date.now() - this.start_time));
        }, 1000);
        if (this.failed) {
            return;
        }
        // if (!data.bytes_request_supported) {
        //     this.handleDownloadError('Error: Byte Requests Not Supported');
        //     return;
        // }

        this.updateStatus(DownloadStatus.PENDING);
        this.element.querySelector('.download-detail[data-type=final-file] .value').innerText = data.final_file;

        if (this.download.total_size !== -1) {
            this.element.querySelector('.download-detail[data-type=size] .value').innerText = DownloadWrapper.bytesToHumanReadable(settings.items.preferredUnit, data.size);
            this.element.querySelector('.progress-bar-wrapper').classList.add("infinite");
        } else
            this.element.querySelector('.download-detail[data-type=size] .value').innerText = "Unknown";
    }

    handleDownloadUpdate(update) {
        if (this.failed)
            return;

        if (Date.now() - this.last_update.time > 800) {

            const speed = (update.downloaded_bytes - this.last_update.bytes_progress) / (Date.now() - this.last_update.time); // bytes per millisecond
            const time_left = ((this.download.total_length - update.downloaded_bytes) / speed); // milliseconds
            const eta = Date.now() + time_left; // milliseconds
            const percentProgress = Math.floor((update.downloaded_bytes / this.download.total_length) * 10000) / 100;
            ipcRenderer.send('progress', percentProgress / 100);

            if (this.download.total_length === -1) {
                this.element.querySelector('.progress').innerText = "Unknown";
                this.element.querySelector('.download-detail[data-type=size] .value').innerText = "Unknown";
                this.element.querySelector('.download-detail[data-type=progress] .value').innerText = DownloadWrapper.bytesToHumanReadable(settings.items.preferredUnit, update.downloaded_bytes);
            } else {
                this.element.querySelector('.progress-bar-inner').style.width = percentProgress + "%";
                this.element.querySelector('.progress').innerText = percentProgress + "%";
                this.element.querySelector('.download-detail[data-type=progress] .value').innerText = `${DownloadWrapper.bytesToHumanReadable(settings.items.preferredUnit, update.downloaded_bytes)} / ${DownloadWrapper.bytesToHumanReadable(settings.items.preferredUnit, this.download.total_length)}`;
            }
            this.element.querySelector('.download-detail[data-type=speed] .value').innerText = DownloadWrapper.bytesToHumanReadable(settings.items.preferredUnit, Math.floor(speed * 1000)) + " / s"; //convert to per second
            this.element.querySelector('.download-detail[data-type=eta] .value').innerText = `${new Date(eta).toLocaleString()} (${DownloadWrapper.miliToHumanReadable(time_left)})`;
            this.element.querySelector('.download-detail[data-type=parts-done] .value').innerText = `${update.parts_done} / ${this.download.numParts}`;
            this.last_update.time = Date.now();
            this.last_update.bytes_progress = update.downloaded_bytes;
        }
    }

    handleFileCombineUpdate(update) {
        if (this.failed) {
            return;
        }
        if (Date.now() - this.last_update.time > 800) {
            const speed = (update.transferred_bytes - this.last_update.bytes_progress) / (Date.now() - this.last_update.time); // bytes per millisecond
            const time_left = ((this.download.total_length - update.transferred_bytes) / speed); // milliseconds
            const eta = Date.now() + time_left; // miliseconds
            const percentProgress = Math.floor((update.transferred_bytes / this.download.total_length) * 10000) / 100;
            ipcRenderer.send('progress', percentProgress / 100);
            this.element.querySelector('.progress-bar-inner').style.width = percentProgress + "%";
            this.element.querySelector('.progress').innerText = percentProgress + "%";
            this.element.querySelector('.download-detail[data-type=speed] .value').innerText = DownloadWrapper.bytesToHumanReadable(settings.items.preferredUnit, Math.floor(speed * 1000)) + " / s"; //convert to per second
            this.element.querySelector('.download-detail[data-type=eta] .value').innerText = `${new Date(eta).toLocaleString()} (${DownloadWrapper.miliToHumanReadable(time_left)})`;
            this.element.querySelector('.download-detail[data-type=progress] .value').innerText = `${DownloadWrapper.bytesToHumanReadable(settings.items.preferredUnit, update.transferred_bytes)} / ${DownloadWrapper.bytesToHumanReadable(settings.items.preferredUnit, this.download.total_length)}`;
            this.element.querySelector('.download-detail[data-type=parts-done] .value').innerText = `${update.parts_done} / ${this.download.numParts}`;
            this.last_update.time = Date.now();
            this.last_update.bytes_progress = update.transferred_bytes;
        }
    }

    handleDownloadError(error) {
        clearInterval(this.elapsed_time_interval);
        this.updateStatus(DownloadStatus.FAILED);
        this.failed = true;
        this.element.querySelector('.download-detail[data-type=error] .value').innerText = error.toString();
        this.download.cancel();
        this.emit('notify', 'Download Failed', `"${this.file_name}" has failed.`);
    }

    handleDownloadFinishing() {
        this.last_update = {
            time: 0,
            bytes_progress: 0,
        };
        ipcRenderer.send('progress', 2);
        if (this.failed) {
            this.emit('startNextDownload');
            return;
        }
        this.updateStatus(DownloadStatus.FINISHING);
        this.emit('startNextDownload');
    }

    handleDownloadComplete() {
        ipcRenderer.send('progress', -1);
        if (this.failed) {
            return;
        }
        clearInterval(this.elapsed_time_interval);
        this.updateStatus(DownloadStatus.COMPLETE);
        this.emit('notify', 'Download Complete', `Your download, ${this.file_name}, is complete!`);

        if (this.download.total_length === -1)
            this.element.querySelector('.download-detail[data-type=size] .value').innerText = DownloadWrapper.bytesToHumanReadable(settings.items.preferredUnit, this.download.downloaded_bytes);

        this.element.querySelector('.progress').innerText = "100%";
        this.element.querySelector('.download-detail[data-type=eta] .value').innerText = `${new Date().toLocaleString()}`;
        this.element.querySelector('.download-detail[data-type=progress] .value').innerText = `${DownloadWrapper.bytesToHumanReadable(settings.items.preferredUnit, this.download.total_length)} / ${DownloadWrapper.bytesToHumanReadable(settings.items.preferredUnit, this.download.total_length)}`;
        this.element.querySelector('.download-detail[data-type=parts-done] .value').innerText = `${this.download.numParts} / ${this.download.numParts}`;

        document.querySelector('#complete-downloads').append(this.element);
    }
};

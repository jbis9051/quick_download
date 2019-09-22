const EventEmitter = require('events');
const fs = require('fs');

class Part extends EventEmitter {
    constructor(url, from_byte, to_byte, file_path, request, customHeaders) {
        super();
        this.url = url;
        this.from_byte = from_byte;
        this.to_byte = to_byte;
        this.current_byte = from_byte;
        this.done = false;
        this.request = request;
        this.customHeaders = customHeaders;
        this.file = fs.createWriteStream(file_path, "utf8");
    };

    download_bytes() {
        return new Promise((resolve, reject) => {
            this.download = this.request({
                method: 'GET',
                url: this.url,
                headers: this.to_byte !== -1 ? {
                    ...this.customHeaders,
                    range: `bytes=${this.from_byte}-${this.to_byte}`
                } : this.customHeaders
            });
            this.download
                .on('data', res => {
                    this.current_byte += res.length;
                    this.emit('update', {
                        newBytes: res.length,
                        currentProgress: this.current_byte,
                    })
                })
                .on('error', e => {
                    this.emit('error', e);
                    reject(e);
                })
                .on('end', () => {
                    this.done = true;
                    this.file.end();
                    this.emit('complete');
                    resolve();
                })
                .pipe(this.file);
        });
    }

    cancel() {
        if (this.download) {
            this.download.abort();
        }
    }
}

module.exports = Part;

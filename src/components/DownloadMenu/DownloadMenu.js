import './DownloadMenu.css';

import React from 'react';
import StandardMenu from "../Shared/StandardMenu/StandardMenu";
import Tool from "../Shared/tool";
import Alert from "../Shared/alert";
import DownloadCarrier from "../../download-carrier";
import Enums from "../../enum";

const {Menus} = Enums;


const _electron = window.require('electron');

export default class DownloadMenu extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            name: "",
            url: "",
            headers: "",
            cookieURL: "",
            cookies: null,
        };

        this.changeName = this.changeName.bind(this);
        this.changeURL = this.changeURL.bind(this);
        this.changeHeaders = this.changeHeaders.bind(this);
    }
    changeName(e){
        this.setState({
            name: e
        })
    }
    changeURL(e){
        this.setState({
            url: e
        })
    }
    changeHeaders(e){
        this.setState({
            headers: e
        })
    }
    getDownloads() {
        return this.props.pastDownloads;
    }

    getDownloadNames() {
        return this.getDownloads().map(i => i ? i.name || "" : i);
    }

    getDownloadUrls() {
        return this.getDownloads().map(i => i ? i.url || "" : i);
    }

    getDownloadHeaders() {
        return this.getDownloads().map(i => i ? i.headers || "" : i);
    }

    filterSuggestion(i) {
        return (i.name || "").toLowerCase().indexOf((this.state.downloadName || "").toLowerCase()) >= 0
            && (i.url || "").toLowerCase().indexOf((this.state.downloadURL || "").toLowerCase()) >= 0
            && (i.headers || "").toLowerCase().indexOf((this.state.customHeaders || "").toLowerCase()) >= 0
    }

    updateCookies(e) {
        this.setState({cookieURL: e.target.value});
        console.log(e.target.value);
    }

    async _handleEnter() {
        if (this.state.name && this.state.url) {
            let shouldContinue = true;
            if (!DownloadCarrier.JSONparse(this.state.customHeaders)) {
                this.props.close();
                shouldContinue = await new Promise(resolve => {
                    let box;
                    this.alert(
                        // TODO make into component
                        <Alert noClose={true}
                               ref={dialog => box = dialog}
                               key={new Date().getTime().toLocaleString()}
                               header={"Invalid JSON"}>
                            <div>
                                The custom headers input is not valid JSON. Would
                                you like to continue
                                download <b>without</b> custom headers or cancel?
                                <div className={"right"}>
                                    <button onClick={() => {
                                        this.props.close();
                                        this.setState({
                                            customHeaders: "",
                                        });
                                        resolve(true);
                                    }
                                    }>Clear Custom Headers
                                    </button>

                                    <button onClick={() => {
                                        this.close();
                                        this.props.changeMenu(Menus.NEW_DOWNLOAD);
                                        resolve(false);
                                    }}>Cancel
                                    </button>
                                </div>
                            </div>
                        </Alert>);
                });

            }
            if (shouldContinue) {
                const download = await this.props.createDownload(this.state.url, this.state.name, this.state.customHeaders);
                if (download) {
                    this.props.queueDownload(download);
                    await download.initiateDownload();
                }
            }
        }
    }

    render() {
        return (
            <StandardMenu title={"New Download"} close={e => this.props.close()}>
                <div className={"formItem"}>
                    <label htmlFor={"dl-name"}>The file name of the download</label>
                    <input autoFocus={true}
                           onFocus={field => this.setState({focused: field.target})}
                           onBlur={() => this.setState({focused: null})}
                           value={this.state.name}
                           onChange={e => this.changeName( e.target.value)}
                           className={"mousetrap dl-name input_standard"}
                           id={"dl-name"}
                           placeholder={"Download Name"}/>
                    <div className={"suggestions"}>
                        {
                            this.getDownloads().map((i, a, x) => {
                                if (i && i.name.length > 1 && this.filterSuggestion(i)) {
                                    return (<div key={a}
                                                 onClick={() => this.acceptSuggestion(a)}
                                                 className={"suggestion"}>
                                        <span>{i.name}</span>
                                        <br/>
                                    </div>);
                                }
                            })
                        }
                    </div>
                </div>

                <div className={"formItem"}>
                    <label htmlFor={"dl-url"}>The location of the file to download</label>
                    <input onFocus={field => this.setState({focused: field.target})}
                           onBlur={() => this.setState({focused: null})}
                           value={this.state.url || ""}
                           onChange={e => this.changeURL( e.target.value)}
                           className={"input_standard dl-url mousetrap url"}
                           id={"dl-url"}
                           placeholder={"Download URL"}/>
                    <div className={"suggestions"}>
                        {
                            this.getDownloads().map((i, a, x) => {
                                if (i && i.url.length > 1 && this.filterSuggestion(i)) {
                                    return (<div key={a}
                                                 onClick={() => this.acceptSuggestion(a)}
                                                 className={"suggestion"}>
                                        <span>{i.url}</span>
                                        <br/>
                                    </div>);
                                }
                            })
                        }
                    </div>
                </div>
                <div className={"formItem"}>
                    <label htmlFor={"dl-headers"}>Custom Headers (JSON)</label>
                    <textarea onFocus={field => this.setState({focused: field.target})}
                              onBlur={() => this.setState({focused: null})}
                              value={this.state.customHeaders}
                              onChange={e => this.changeHeaders( e.target.value)}
                              className={"input_standard dl-headers standard_code mousetrap url"}
                              id={"dl-headers"}
                              placeholder={'Download Headers (JSON)'}
                    />
                    <div className={"suggestions"}>
                        {this.getDownloads().map((i, a, x) => {
                            if (i && i.headers.length > 1 && this.filterSuggestion(i)) {
                                return (<div key={a}
                                             onClick={() => this.acceptSuggestion(a)}
                                             className={"suggestion"}>
                                    <span>{i.headers}</span>
                                    <br/>
                                </div>);
                            }
                        })}
                    </div>
                </div>
                <button className={"confirm-btn"}
                        onClick={async () => {
                            let url = await new Promise(resolve => {
                                this.props.close();
                                this.props.alert(
                                    <Alert noClose={true}
                                                  header={"Enter A URL"}>
                                    <div>
                                        <input
                                            value={this.state.cookieURL}
                                            onChange={e => this.updateCookies(e)}
                                            className={"input_standard dl-url mousetrap url"}
                                            placeholder={"Browse URL"}/>
                                        <div className={"right"}>
                                            <button onClick={() => {
                                                this.props.close();
                                                resolve(this.state.cookieURL);
                                            }
                                            }>Ok
                                            </button>

                                            <button onClick={() => {
                                                resolve(false);
                                            }}>Cancel
                                            </button>
                                        </div>
                                    </div>
                                </Alert>);
                            });
                            this.props.changeMenu(Menus.NEW_DOWNLOAD);
                            if (url) {
                                let cookies = _electron.ipcRenderer.sendSync('get-browser-cookies', url);
                                this.setState({
                                    customHeaders: `{'Cookie': '${cookies.map(el => `${el.name}=${el.value}`).join(';')}'}`,
                                });
                            }
                        }}>Get Cookies
                </button>
                <div className={"right-align"}>
                    <Tool left={true} tooltip={"Begin download"} className={"confirm-btn"}
                          icon={"fas fa-check"}
                          onClick={async () => await this._handleEnter()}/>
                </div>
            </StandardMenu>
        )
    }
}

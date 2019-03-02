import React, {Component} from 'react';

import './css/App.css';
import './css/box.css';
import './css/settings.css';

// import * as Mousetrap from "Mousetrap";

import Tool from './components/tool';
import Download from './components/download';
import WindowFrame from './components/windowframe';
import Alert from './components/alert';
import {$} from './components/utils'
// import * as path from "path";
// import * as os from "os";

const path = window.require('path');
const os = window.require('os');

const Mousetrap = window.require('mousetrap');

const _electron = window.require('electron');
const remote = _electron.remote;

window.localStorage.theme = window.localStorage.theme || "dark";
window.localStorage.saveLocation = window.localStorage.saveLocation || path.join(os.homedir(), 'Downloads');
window.localStorage.proxySettings = window.localStorage.proxySettings || "none";
window.localStorage.proxyRequiresCredentials = window.localStorage.proxyRequiresCredentials || false;
window.localStorage.partsToCreate = window.localStorage.partsToCreate || 10;

let platform = remote.require('os').platform();

if (platform !== "win32" && platform !== "darwin")
	platform = "other";

class App extends Component {

	constructor(...args) {
		super(...args);
		document.title = "Quick Downloader";

		this.state = {
			downloads: [],
			promptShowing: false,
			downloadName: "",
			downloadURL: "",
			boxes: [],
			settingsVisible: false,
			currentSelection: 0
		};
	}

	alert(box) {
		this.setState(prev => ({boxes: [...prev.boxes, box]}));
		console.log("showing box");
	}

	showPrompt() {
		if (!this.state.promptShowing) {
			this.setState(prevState => ({promptShowing: !prevState.promptShowing}));
		}
	}

	closePrompt() {
		this.setState({downloadName: "", downloadURL: "", promptShowing: false});
	}

	beginDownload() {
		if (this.state.downloadURL) {
			this.setState({
				downloads: [...this.state.downloads,
					<Download key={Date.now()} url={this.state.downloadURL} name={this.state.downloadName}/>]
			});
			this.closePrompt();

			if (!this.state.stopSave)
				App.addToDownloadHistory(this.state.downloadURL, this.state.downloadName);

			this.setState({stopSave: true});
		} else {
			this.setState({requiredField: true});
		}
	}

	changeSelection(dir) {
		if (this.state.focused) {
			console.log(dir);
			if (this.state.focused.classList.contains('dl-name'))
				this.setState(prev => {
					const maxSelection = this.getDownloadNames().length;
					return {currentSelection: (maxSelection + (prev.currentSelection + dir) % maxSelection) % maxSelection};
				});
			else if (window.activeElement.classList.contains('dl-url'))
				this.setState(prev => {
					const maxSelection = this.getDownloadUrls().length;
					return {currentSelection: (maxSelection + (prev.currentSelection + dir) % maxSelection) % maxSelection};
				});
		}
	}

	static addToDownloadHistory(url, name) {
		const _downloadHistory = JSON.parse(window.localStorage.downloadHistory);
		_downloadHistory.push({url, name});

		window.localStorage.downloadHistory = JSON.stringify(_downloadHistory);
	}

	getDownloadNames() {
		window.localStorage.downloadHistory = window.localStorage.downloadHistory || JSON.stringify([]);
		return JSON.parse(window.localStorage.downloadHistory).filter(i => (i.name).toLowerCase().indexOf((this.state.downloadName).toLowerCase()) >= 0).map(i => i.name);
	}

	getDownloadUrls() {
		window.localStorage.downloadHistory = window.localStorage.downloadHistory || JSON.stringify([]);
		return JSON.parse(window.localStorage.downloadHistory).filter(i => (i.url).toLowerCase().indexOf((this.state.downloadURL).toLowerCase()) >= 0).map(i => i.url);
	}

	componentDidMount() {
		if (!window.localStorage.downloadHistory)
			window.localStorage.downloadHistory = JSON.stringify([]);

		try {
			Mousetrap.bind('mod+n', () => this.showPrompt());
			Mousetrap.bind('esc', () => {
				this.closePrompt();
			});
			Mousetrap.bind('mod+j', () => this.pastDownloads());
			Mousetrap.bind('f11', () => remote.getCurrentWindow().setFullScreen(!remote.getCurrentWindow().isFullScreen()));

			Mousetrap.bind('up', () => this.changeSelection(-1) || false);
			Mousetrap.bind('down', () => this.changeSelection(1) || false);
			Mousetrap.bind('enter', () => {
				if (this.state.promptShowing) this.acceptSuggestion(this.state.currentSelection)
			});
		} catch (e) {
			this.alert(<Alert key={new Date().toLocaleString()} header={"An error has occurred"}
			                  body={"A dependency has failed to load, keyboard shortcuts will be disabled. Otherwise, everything else should work."}/>)
		}

		window.App = {
			show: () => this.showPrompt(),
			showPastDownloads: () => this.pastDownloads(),
			close: () => App.confirmExit(),
			toggleFullScreen: () => remote.getCurrentWindow().setFullScreen(!remote.getCurrentWindow().isFullScreen()),
			about: () => this.about()
		};

		// _electron.remote.getCurrentWindow().setMenu;
		_electron.remote.getCurrentWindow().setMenu(_electron.remote.Menu.buildFromTemplate([{
			label: "File",
			submenu: [{label: "New Download", click: window.App.show}, {
				label: "Show Past Downloads",
				click: window.App.showPastDownloads
			}, {type: "separator"}, {label: "Exit", click: window.App.close}, {
				label: "Open Settings",
				click: () => this.showSettings()
			}]
		}, {
			label: "View",
			submenu: [{label: "Theme", submenu: [{label: "Dark"}, {label: "Light"}, {role: "togglefullscreen"}]}]
		}, {label: "Help", submenu: [{label: "About", click: window.App.about}, {label: "Docs"}]}]));
	}

	acceptSuggestion(number) {
		const names = this.getDownloadNames(),
			urls = this.getDownloadUrls();

		this.setState({
			downloadURL: urls[number],
			downloadName: names[number]
		});

		this.setState({
			stopSave: true
		});

		$('.suggestions').style.display = "none";

		this.setState({
			currentSelection: 0,
			focused: null
		})
		// $(".confirm-btn").focus();
	}

	showSettings() {
		this.settingsVisible = !this.settingsVisible;
	}

	static confirmExit() {
		window.close();
	}

	pastDownloads() {

	}

	changePath() {
		window.localStorage.saveLocation = _electron.ipcRenderer.sendSync('pickDir');
		this.forceUpdate();
	}

	about() {
		this.alert(<Alert key={new Date().toLocaleString()} header={"About"} body={<div>
			<ul className={"about-details"}>
				<li>
					<b>Node Version: </b>
					<span>{window.process.versions.node}</span>
				</li>
				<li>
					<b>Electron Version: </b>
					<span>{window.process.versions.electron}</span>
				</li>
				<li>
					<b>Chromium Version: </b>
					<span>{window.process.versions.chrome}</span>
				</li>
				<li>
					<b>V8 Version: </b>
					<span>{window.process.versions.v8}</span>
				</li>
				<li>
					<b>React Version: </b>
					<span>{React.version}</span>
				</li>
			</ul>
		</div>}/>)
	}

	// hello world

	render() {
		return (
			<div className="wrapper">
				<WindowFrame/>
				<div className="App">
					<header>
						<Tool shortcut="+" onClick={e => this.showPrompt()} icon={"fas fa-plus"}/>
						<Tool shortcut="+"
						      onClick={() => this.setState(prev => ({settingsVisible: !prev.settingsVisible}))}
						      icon={"fas fa-cog"}/>
						{platform !== "darwin" ?
							<div className={"menu"}>
								<div className={"submenu"}>
									<label className={"menuTitle"}>File</label>
									<div className={"options"}>
										<div onClick={e => this.showPrompt()} className={"option"}>
											New Download
											<div className={"accelerator"}>
												{platform === "darwin" ? "Cmd+N" : "Ctrl+N"}
											</div>
										</div>
										<div className={"option"}>
											Show Past Downloads
											<div className={"accelerator"}>
												{platform === "darwin" ? "Cmd+J" : "Ctrl+J"}
											</div>
										</div>
										<hr/>
										<div onClick={() => App.confirmExit()} className={"option"}>
											Exit
											<div className={"accelerator"}>
												{platform === "darwin" ? "Cmd+W" : "Ctrl+W"}
											</div>
										</div>
										<div
											onClick={() => this.setState(prev => ({settingsVisible: !prev.settingsVisible}))}
											className={"option"}>
											Open Settings
										</div>
									</div>
								</div>
								<div className={"submenu"}>
									<label className={"menuTitle"}>View</label>
									<div className={"options"}>
										<div className={"option"}>
											<div className={"submenu"}>
												<label className={"menuTitle"}>Theme</label>
												<div className={"options"}>
													<div className={"option"}>
														Dark
													</div>
													<div className={"option"}>
														Light
													</div>
												</div>
											</div>
										</div>
										<div className={"option"}
										     onClick={() => remote.getCurrentWindow().setFullScreen(!remote.getCurrentWindow().isFullScreen())}>
											Full Screen
											<div className={"accelerator"}>
												F11
											</div>
										</div>
									</div>
								</div>
								<div className={"submenu"}>
									<label className={"menuTitle"}>Help</label>
									<div className={"options"}>
										<div className={"option"} onClick={() => this.about()}>About</div>
										<div className={"option"}>Docs</div>
									</div>
								</div>
							</div> : null
						}
					</header>

					<div className="downloads">
						{this.state.downloads}
					</div>
					{/* ------------------------------------------------------------------------------------------------New Download Prompt------------------------------------------------------------------------------------------------ */}
					{this.state.promptShowing ?
						<div className="prompt">
							<div className={"right-align"}>
								<Tool className={"prompt-close-btn"} icon={"fas fa-times"}
								      onClick={e => this.closePrompt()}/>
							</div>

							<div className={"formItem"}>
								<label htmlFor={"dl-name"}>The file name of the download</label>
								<input autoFocus={true} onFocus={field => this.setState({focused: field.target})}
								       onBlur={() => this.setState({focused: null})}
								       value={this.state.downloadName}
								       onChange={e => this.setState({downloadName: e.target.value})}
								       className={"mousetrap dl-name"} id={"dl-name"} placeholder={"Download Name"}/>
								<div className={"suggestions"}>
									{this.getDownloadNames().map((i, a) => <div key={a}
									                                            className={"suggestion" + (this.state.currentSelection === a ? " focused" : "")}><span
										onClick={() => this.acceptSuggestion(a)}>{i}</span><br/></div>)}
								</div>
							</div>

							<div className={"formItem"}>
								<label htmlFor={"dl-url"}>The location of the file to download</label>
								<input onFocus={field => this.setState({focused: field.target})}
								       onBlur={() => this.setState({focused: null})}
								       value={this.state.downloadURL}
								       onChange={e => this.setState({downloadURL: e.target.value})}
								       className={"mousetrap url" + " " + this.state.required ? "required" : ""}
								       id={"dl-url"}
								       placeholder={"Download URL"}/>
								<div className={"suggestions"}>
									{this.getDownloadUrls().map((i, a) => <div key={a}
									                                           className={"suggestion" + (this.state.currentSelection === a ? " focused" : "")}><span
										onClick={() => this.acceptSuggestion(a)}>{i}</span><br/></div>)}
								</div>
							</div>

							<div className={"right-align"}>
								<Tool className={"confirm-btn"} icon={"fas fa-check"}
								      onClick={() => this.beginDownload()}/>
							</div>
						</div>
						: undefined
					}
					{/*------------------------------------------------------------------------------------------------Settings Prompt------------------------------------------------------------------------------------------------*/}
					{this.state.settingsVisible ?
						<div className={"prompt settings"}>
							<header>
								<h1>Settings</h1>
								<div className={"right-align"}>
									<Tool className={"prompt-close-btn"} icon={"fas fa-times"}
									      onClick={e => this.setState({settingsVisible: false})}/>

								</div>
							</header>

							<h2>Appearance</h2>
							<div className={"settings-group"}>
								<div className={"setting"}>
									<label htmlFor="dark">Dark Theme</label>
									<input
										onChange={field => {
											if (field.target.value === "on") {
												window.localStorage.theme = "dark";
											}
											console.log(field.target.value)
										}}
										className={"theme"}
										name={"theme"}
										id={"dark"}
										type={"radio"}
										checked={window.localStorage.getItem('theme') === 'dark'}/>
								</div>
								<div className={"setting"}>
									<label htmlFor="light">Light Theme</label>
									<input
										onChange={field => {
											if (field.target.value === "on") {
												window.localStorage.theme = "dark";
											}
											console.log(field.target.value);
										}}
										className={"theme"}
										name={"theme"}
										id={"light"}
										type={"radio"}
										checked={window.localStorage.getItem('theme') === 'light'}/>
								</div>
							</div>

							<br/>

							<h2>General</h2>

							<label onClick={() => this.changePath()} htmlFor="save-location"
							       className={"saveLocation"}>{window.localStorage.saveLocation}</label>
							<label htmlFor={"save-location"}>Save Location</label>

							<input id={"numOfParts"}
							       placeholder={"Number of parts to use during download"}
							       type={"number"}
							       min={5}
							       max={30}
							       value={window.localStorage.partsToCreate}
							       onChange={field => window.localStorage.partsToCreate = Number(field.target.value)}/>
							<label htmlFor={"numOfParts"}>How many parts to use during download</label>
							{/* // TODO: Add reference to docs explaining how to find the optimum part number */}

							<input type={"button"} onClick={() => {
								if (_electron.ipcRenderer.sendSync('confirmClear'))
									window.localStorage.clear()
							}} value={"Reset to default settings"}/>

							<br/>

							<h2>Network</h2>

							<div className={"setting"}>
								<label htmlFor={"none"}>None</label>
								<input type={"radio"} name={"proxy-auth-type"}
								       checked={window.localStorage.getItem('proxySettings') === 'none'} id={"none"}
								       onChange={field => {
									       if (field.target.value === "on") window.localStorage.setItem('proxySettings', 'none');
									       this.forceUpdate();
								       }}/>
							</div>

							<div className={"setting"}>
								<label htmlFor={"none"}>Pac Script</label>
								<input type={"radio"} name={"proxy-auth-type"}
								       checked={window.localStorage.getItem('proxySettings') === 'pac'} id={"pac"}
								       onChange={field => {
									       if (field.target.value === "on") window.localStorage.setItem('proxySettings', 'pac');
									       this.forceUpdate();
								       }}/>
							</div>

							<div className={"setting"}>
								<label htmlFor={"none"}>With Credentials</label>
								<input type={"radio"}
								       name={"proxy-auth-type"}
								       checked={window.localStorage.getItem('proxySettings') === 'auth'} id={"auth"}
								       onChange={field => {
									       if (field.target.value === "on") window.localStorage.setItem('proxySettings', 'auth');
									       this.forceUpdate();
								       }}/>
							</div>

							{
								window.localStorage.getItem('proxySettings') === "pac" ?
									<div>
										<input placeholder={"https://example.com/proxy/proxy.pac"}
										       value={window.localStorage.getItem('pacFile') || ""}
										       onChange={field => window.localStorage.setItem('pacFile', field.target.value)}
										       id={"pac-location"}/>

										<label htmlFor={"pac-location"}>Pac Script Location</label></div> :
									(window.localStorage.getItem('proxySettings') === "auth" ? (
										<div>
											<input placeholder={"proxy.example.com"}
											       value={window.localStorage.getItem('proxyHost') || ""}
											       onChange={field => window.localStorage.setItem('proxyHost', field.target.value)}
											       id={"proxy-host"}/>
											<label htmlFor={"proxy-host"}>Proxy Host</label>

											<input placeholder={8080}
											       type={"number"}
											       value={window.localStorage.getItem('proxyPort') || "80"}
											       onChange={field => window.localStorage.setItem('proxyPort', field.target.value)}
											       id={"proxy-port"}/>
											<label htmlFor={"proxy-port"}>Proxy Port</label>

											<Checkbox checked={window.localStorage.proxyRequiresCredentials === "true"}
											          onChange={value => (void window.localStorage.setItem("proxyRequiresCredentials", value)) || this.forceUpdate()}
											          text={"Proxy Requires Credentials"}/>

											{(window.localStorage.proxyRequiresCredentials === "true" ?
												<div>
													<input placeholder={"Proxy Username"}
													       onChange={field => window.localStorage.proxyUsername = field.target.value}
													       value={window.localStorage.proxyUsername}
													       id={"proxy-username"}/>
													<input placeholder={"Proxy Password"} type={"password"}
													       onChange={field => window.localStorage.proxyPassword = field.target.value}
													       value={window.localStorage.proxyPassword}
													       id={"proxy-password"}/>
												</div> : null)}

										</div>
									) : null)
							}

						</div>
						: null}
				</div>
				<div className={"box-display-area"}>
					{this.state.boxes}
				</div>
			</div>
		);
	}
}

class Checkbox extends React.Component {
	state = {
		checked: this.props.checked
	};

	constructor(props) {
		super(props);
	}

	render() {
		return (
			<div className={"checkbox"}
			     onClick={() => (void this.setState(prev => ({checked: !prev.checked}))) || this.props.onChange(!this.state.checked)}>
				<span className={"label"}>{this.props.text}</span>
				<span className={"indicator" + (this.state.checked ? " checked" : "")}/>
			</div>
		);
	}
}

export default App;
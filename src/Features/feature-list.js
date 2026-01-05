import { relURL } from '../Utilities/usefull-funcs.js';

/** @typedef {import('./ToolBar/tool-bar.js').default} ToolBarFeature */
/** @typedef {import('./Settings/settings.js').default} SettingsFeature */
/** @typedef {import('./Cursors/cursors.js').default} Cursors */
/** @typedef {import('./EyeGaze/eye-gaze.js').default} EyeGazeFeature */
/** @typedef {import('./Text2Speech/text2speech.js').default} Text2Speech */
/** @typedef {import('./VideoCall/video-call.js').default} VideoCall */
/** @typedef {import('./Notifications/notifications.js').default} Notifications */
/** @typedef {import('./AccessControl/access-control.js').default} AccessControl */
/** @typedef {import('./AAC/grid.js').default} AACGrid */
/** @typedef {import('./Apps/apps.js').default} Apps */
/** @typedef {import('./Quiz/quiz.js').default} QuizFeature */
/** @typedef {import('./ShareContent/share-content.js').default} ShareContent */

export class SquildyFeatureProxy {

	/** @return {ToolBarFeature} */
	get toolBar() { return this.getFeature("toolBar"); }

	/** @return {SettingsFeature} */
	get settings() { return this.getFeature("settings"); }

	/** @return {Cursors} */
	get cursors() { return this.getFeature("cursors"); }

	/** @return {EyeGazeFeature} */
	get eyeGaze() { return this.getFeature("eyeGaze"); }

	/** @return {Text2Speech} */
	get text2speech() { return this.getFeature("text2speech"); }

	/** @return {VideoCall} */
	get videoCall() { return this.getFeature("videoCall"); }

	/** @return {Notifications} */
	get notifications() { return this.getFeature("notifications"); }

	/** @return {AccessControl} */
	get accessControl() { return this.getFeature("accessControl"); }

	/** @return {AACGrid} */
	get aacGrid() { return this.getFeature("aacGrid"); }

	/** @return {Apps} */
	get apps() { return this.getFeature("apps"); }

	/** @return {QuizFeature} */
	get quiz() { return this.getFeature("quiz"); }

	/** @return {ShareContent} */
	get shareContent() { return this.getFeature("shareContent"); }

	/** @override */
	getFeature() { }

}

export const FeaturesList = [
	[relURL("./ToolBar/tool-bar.js", import.meta), "toolBar"],
	[relURL("./Settings/settings.js", import.meta), "settings"],
	[relURL("./Cursors/cursors.js", import.meta), "cursors"],
	[relURL("./EyeGaze/eye-gaze.js", import.meta), "eyeGaze"],
	[relURL("./Text2Speech/text2speech.js", import.meta), "text2speech"],
	[relURL("./VideoCall/video-call.js", import.meta), "videoCall"],
	[relURL("./Notifications/notifications.js", import.meta), "notifications"],
	[relURL("./AccessControl/access-control.js", import.meta), "accessControl"],
	[relURL("./AAC/grid.js", import.meta), "aacGrid"],
	[relURL("./Apps/apps.js", import.meta), "apps"],
	[relURL("./Quiz/quiz.js", import.meta), "quiz"],
	[relURL("./ShareContent/share-content.js", import.meta), "shareContent"]
];
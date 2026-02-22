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
/** @typedef {import('./Chat/chat.js').default} ChatFeature */
/** @typedef {import('./KeyboardT/keyboard.js').default} KeyboardFeature */
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

	/** @return {ChatFeature} */
	get chat() { return this.getFeature("chat"); }

	/** @return {KeyboardFeature} */
	get keyboard() { return this.getFeature("keyboard"); }

	/** @return {QuizFeature} */
	get quiz() { return this.getFeature("quiz"); }

	/** @return {ShareContent} */
	get shareContent() { return this.getFeature("shareContent"); }

	/** @override */
	getFeature() { }

}

export const FeaturesList = [
	[ () => import("./ToolBar/tool-bar.js"), "toolBar"],
	[ () => import("./Settings/settings.js"), "settings"],
	[ () => import("./Cursors/cursors.js"), "cursors"],
	[ () => import("./EyeGaze/eye-gaze.js"), "eyeGaze"],
	[ () => import("./Text2Speech/text2speech.js"), "text2speech"],
	[ () => import("./VideoCall/video-call.js"), "videoCall"],
	[ () => import("./Notifications/notifications.js"), "notifications"],
	[ () => import("./AccessControl/access-control.js"), "accessControl"],
	[ () => import("./AAC/grid.js"), "aacGrid"],
	[ () => import("./Apps/apps.js"), "apps"],
	[ () => import("./Chat/chat.js"), "chat"],
	[ () => import("./KeyboardT/keyboard.js"), "keyboard"],
	[ () => import("./Quiz/quiz.js"), "quiz"],
	[ () => import("./ShareContent/share-content.js"), "shareContent"]
];
import { ToolBarFeature } from "./ToolBar/tool-bar.js"
import { AccessControl } from "./AccessControl/access-control.js"
import { AACGrid } from "./AAC/grid.js"
import { QuizFeature } from "./Quiz/quiz.js"
import { EyeGazeFeature } from "./EyeGaze/eye-gaze.js"
import { Notifications } from "./Notifications/notifications.js"
import { Cursors } from "./Cursors/cursors.js"
import { VideoCall } from "./VideoCall/video-call.js"
import { Text2Speech } from "./Text2Speech/text2speech.js"
import { ShareContent } from "./ShareContent/share-content.js"
import { SettingsFeature } from "./Settings/settings.js"

export const FEATURES = [
    {
        class: ToolBarFeature,
        name: "toolBar",
        layers: {
            toolBar: {
                type: "panel", 
                area: "tools",
            },
            toolBarRing: {
                type: "area",
                area: "mainScreen",
                mode: "overlay",
                index: 220,
            }
        },
    },
    {
        class: SettingsFeature,
        name: "settings",
        layers: {
            settingsWindow: {
                type: "area",
                area: "fullAspectArea",
                index: 81,
                mode: "occupy",
            }
        }
    },
    
    {
        class: VideoCall,
        name: "videoCall",
        layers: {
            topPanelWidget: {
                type: "panel",
                area: "top",
            },
            sidePanelWidget: {
                type: "panel",
                area: "side",
            },
            mainAreaWidget: {
                type: "area",
                area: "fullAspectArea",
                index: 50,
            }
        }
    },
    {
        class: Text2Speech,
        name: "text2speech"
    },
    {
        class: Notifications,
        name: "notifications",
        layers: {
            notificationPanel: {
                type: "area",
                area: "entireScreen",
                index: 120,
                mode: "overlay"
            }
        }
    },
    {
        class: AACGrid,
        name: "aacGrid",
        layers: {
            board: {
                type: "area",
                area: "fullAspectArea",
                index: 80,
                mode: "occupy",
            }
        }
    },
    {
        class: QuizFeature,
        name: "quiz",
        layers: {
            board: {
                type: "area",
                area: "fullAspectArea",
                index: 80,
                mode: "occupy",
                name: "main",
            }
        }
    },
    {
        class: AccessControl,
        name: "accessControl",
        layers: {
            overlay: {
                type: "area",
                area: "entireScreen",
                index: 310,
                mode: "overlay"
            }
        }
    },
    {
        class: ShareContent,
        name: "shareContent",
        layers: {
            contentView: {
                type: "area",
                area: "fullAspectArea",
                index: 60,
            }
        }
    },
    {
        class: Cursors,
        name: "cursors",
        layers: {
            cursorsPanel: {
                type: "area",
                area: "entireScreen",
                index: 320,
                mode: "overlay"
            },
            fullAspectArea: {
                type: "area",
                area: "fullAspectArea",
                mode: "overlay",
                index: -1,
            },
            fixedAspectArea: {
                type: "area",
                area: "fixedAspectArea",
                mode: "overlay",
                index: -1,
            }
        }
    },
    {
        class: EyeGazeFeature,
        name: "eyeGaze",
        layers: {
            feedbackWindow: {   // EyeGaze feedback window
                type: "area",
                area: "fullAspectArea",
                index: 85,
                mode: "occupy",
                name: "main",
                fix: {
                    toolbar: true
                }
            },
            calibrationWindow: { // Calibration window
                type: "area",
                area: "entireScreen",
                index: 500,
                mode: "overlay",
            },
            testScreen: { // Test window
                type: "area",
                area: "entireScreen",
                index: 215,
                mode: "overlay",
            },
            restButton: { // Rest Button
                type: "panel",
                area: "bottom",
            }
        }
    }
]

export function loadResources(){
    FEATURES.map(f => f.class.loadResources())
}

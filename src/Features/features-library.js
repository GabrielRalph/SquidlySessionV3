import { ToolBarFeature } from "./ToolBar/tool-bar.js"
import { AccessControl } from "./AccessControl/access-control.js"
import { AACGrid } from "./AAC/grid.js"
import { QuizFeature } from "./Quiz/quiz.js"
import { EyeGazeFeature } from "./EyeGaze/eye-gaze.js"
import { Notifications } from "./Notifications/notifications.js"
import { Cursors } from "./Cursors/cursors.js"

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
                area: "fullAspectArea",
                mode: "overlay",
                index: 90,
            }
        },
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
                fix: {
                    toolbar: true
                }
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
                fix: {
                    toolbar: true
                }
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
                index: 100,
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

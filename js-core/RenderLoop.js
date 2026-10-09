import { cameraMeta, cameraPerspective, cameraTop, rendererPerspective, rendererTop, rendererMeta, scene } from './PerspectiveEngine.js';
import { stationPointMarker, lineOfSight, picturePlane, horizonLine } from './Apparatus.js';

// ==========================================
// THE RENDER LOOP
// Drawing view: objects only (no apparatus, so it matches what you'd draw).
// Top / Meta views: apparatus visible, but no horizon or vanishing lines.
// ==========================================
export function startRenderLoop(vanishingLinesGroup) {
    function animate() {
        requestAnimationFrame(animate);
        cameraMeta.lookAt(picturePlane.position);

        stationPointMarker.visible = false;
        lineOfSight.visible = false;
        picturePlane.visible = false;
        rendererPerspective.render(scene, cameraPerspective);

        stationPointMarker.visible = true;
        lineOfSight.visible = true;
        picturePlane.visible = true;

        const hlState = horizonLine.visible;
        const vlState = vanishingLinesGroup.visible;
        horizonLine.visible = false;
        vanishingLinesGroup.visible = false;

        rendererTop.render(scene, cameraTop);
        rendererMeta.render(scene, cameraMeta);

        horizonLine.visible = hlState;
        vanishingLinesGroup.visible = vlState;
    }
    animate();
}

import {Composition,Still} from 'remotion';
import {CausticaDemo,Poster} from './Demo';
export const RemotionRoot=()=> <><Composition id="CausticaDemo" component={CausticaDemo} durationInFrames={7200} fps={30} width={1920} height={1080}/><Composition id="CausticaGraphics" component={CausticaDemo} defaultProps={{graphicsOnly:true}} durationInFrames={7200} fps={30} width={1920} height={1080}/><Still id="CausticaPoster" component={Poster} width={1920} height={1080}/></>;

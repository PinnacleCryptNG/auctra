import { useEffect, useState } from "react";
import { Composition, continueRender, delayRender } from "remotion";
import "./brand";
import { FPS, TOTAL } from "./timeline";
import { AuctraDemo } from "./Video";

/** Holds the first frame until the brand fonts are ready, so nothing renders in a fallback face. */
function WithFonts() {
  const [handle] = useState(() => delayRender("fonts"));
  useEffect(() => {
    const faces = ['500 40px "Fraunces Variable"', 'italic 500 40px "Fraunces Variable"', '600 40px "Instrument Sans Variable"', '400 40px "Instrument Sans Variable"', '400 20px "JetBrains Mono Variable"'];
    Promise.all(faces.map((f) => document.fonts.load(f)))
      .then(() => document.fonts.ready)
      .then(() => continueRender(handle));
  }, [handle]);
  return <AuctraDemo />;
}

export function Root() {
  return (
    <>
      <Composition id="Landscape" component={WithFonts} durationInFrames={TOTAL} fps={FPS} width={1920} height={1080} />
      <Composition id="Portrait" component={WithFonts} durationInFrames={TOTAL} fps={FPS} width={1080} height={1920} />
    </>
  );
}

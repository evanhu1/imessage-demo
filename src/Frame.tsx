import React from 'react';
import {Caption} from './Caption';
import {Phone} from './chat/Screen';
import type {Resolved} from './types';

// One full video frame: the phone screen plus overlays (caption).
export const Frame: React.FC<{d: Resolved; frame: number}> = ({d, frame}) => (
  <div style={{position: 'relative', width: d.width, height: d.height, overflow: 'hidden'}}>
    <Phone d={d} frame={frame} />
    {d.caption ? <Caption c={d.caption} frame={frame} width={d.width} height={d.height} /> : null}
  </div>
);

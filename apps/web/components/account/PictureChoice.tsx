"use client";

import { AvatarPicker, type AvatarPickerProps } from "@krizaka/ui/account-settings";
import { useEffect, useRef } from "react";

/**
 * Inside a form, the radio group of Krizaka UI mirrors each picture with a hidden `<input type="radio">` (so the choice travels
 * with the form). Those mirrors have no name of their own: an accessibility audit counts six unlabelled controls (akinaza#440).
 * Each mirror takes the name of the picture it stands for. Until the library names them itself, this is the one place that does.
 */
export function nameMirrors(root: ParentNode): number {
  let named = 0;
  for (const mirror of root.querySelectorAll<HTMLInputElement>('input[type="radio"][aria-hidden="true"]')) {
    const tile = [...root.querySelectorAll('button[role="radio"]')].find((b) => b.getAttribute("value") === mirror.value);
    const name = tile?.getAttribute("aria-label");
    if (name && mirror.getAttribute("aria-label") !== name) {
      mirror.setAttribute("aria-label", name);
      named += 1;
    }
  }
  return named;
}

/** The library's picture choice, its form mirrors named. */
export function PictureChoice(props: AvatarPickerProps) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (host.current) nameMirrors(host.current);
  });
  return (
    <div ref={host} className="contents">
      <AvatarPicker {...props} />
    </div>
  );
}

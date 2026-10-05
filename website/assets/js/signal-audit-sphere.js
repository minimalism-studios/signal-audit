window.SignalAuditSphere = function SignalAuditSphere(options = {}) {
  /*
   * SIGNAL AUDIT — BRAND SPHERE
   *
   * Shared Signal Audit brand renderer.
   *
   * The default palette preserves the approved application
   * treatment: white network geometry with green signal points.
   *
   * Uses the same Fibonacci-sphere topology as the
   * Minimalism corporate hero, adapted for the dark
   * Signal Audit application shell.
   */

  const canvas =
    options.canvas ||
    document.querySelector(
      '[data-signal-audit-brand-sphere]'
    );

  if (!canvas) return;

  const ctx =
    canvas.getContext('2d');

  if (!ctx) return;

  const lineColor =
    options.lineColor || '255, 255, 255';

  const nodeColor =
    options.nodeColor || '85, 230, 177';

  const nodeRadiusMax =
    options.nodeRadiusMax || 1.30;

  const lineAlphaMin =
    options.lineAlphaMin ?? 0.22;

  const lineAlphaMax =
    options.lineAlphaMax ?? 0.70;

  const nodeAlphaMin =
    options.nodeAlphaMin ?? 0.50;

  const nodeAlphaMax =
    options.nodeAlphaMax ?? 1.00;

  const nodeStyle =
    options.nodeStyle || 'fill';

  const nodeStrokeWidth =
    options.nodeStrokeWidth || 1;

  const lineDepthCutoff =
    options.lineDepthCutoff ?? null;

  const rotationDuration =
    options.rotationDuration || 0;

  const NODE_COUNT =
    options.nodeCount || 118;

  const NEIGHBORS = 4;

  const GOLDEN_ANGLE =
    Math.PI * (3 - Math.sqrt(5));

  const nodes = [];

  for (
    let i = 0;
    i < NODE_COUNT;
    i += 1
  ) {
    const y =
      1 -
      (i / (NODE_COUNT - 1)) * 2;

    const radius =
      Math.sqrt(
        Math.max(
          0,
          1 - y * y
        )
      );

    const theta =
      GOLDEN_ANGLE * i;

    nodes.push({
      x:
        Math.cos(theta) *
        radius,

      y,

      z:
        Math.sin(theta) *
        radius,
    });
  }

  /*
   * Same fixed nearest-neighbor topology
   * as the corporate hero sphere.
   */

  const edgeSet =
    new Set();

  const edges = [];

  nodes.forEach(
    (node, index) => {
      const distances =
        nodes
          .map(
            (
              other,
              otherIndex
            ) => {
              if (
                index ===
                otherIndex
              ) {
                return null;
              }

              const dx =
                node.x -
                other.x;

              const dy =
                node.y -
                other.y;

              const dz =
                node.z -
                other.z;

              return {
                index:
                  otherIndex,

                distance:
                  dx * dx +
                  dy * dy +
                  dz * dz,
              };
            }
          )
          .filter(Boolean)
          .sort(
            (a, b) =>
              a.distance -
              b.distance
          )
          .slice(
            0,
            NEIGHBORS
          );

      distances.forEach(
        ({ index: neighbor }) => {
          const a =
            Math.min(
              index,
              neighbor
            );

          const b =
            Math.max(
              index,
              neighbor
            );

          const key =
            `${a}:${b}`;

          if (
            edgeSet.has(key)
          ) {
            return;
          }

          edgeSet.add(key);

          edges.push([
            a,
            b,
          ]);
        }
      );
    }
  );

  /*
   * Preserve the corporate sphere's
   * default orientation.
   */

  const baseRotationY = 0.38;
  const rotationX = -0.18;

  function resize() {
    const rect =
      canvas.getBoundingClientRect();

    const dpr =
      Math.min(
        window.devicePixelRatio ||
          1,
        2
      );

    const pixelWidth =
      Math.max(
        1,
        Math.round(
          rect.width * dpr
        )
      );

    const pixelHeight =
      Math.max(
        1,
        Math.round(
          rect.height * dpr
        )
      );

    if (
      canvas.width !==
        pixelWidth ||
      canvas.height !==
        pixelHeight
    ) {
      canvas.width =
        pixelWidth;

      canvas.height =
        pixelHeight;

      ctx.setTransform(
        dpr,
        0,
        0,
        dpr,
        0,
        0
      );
    }

    return {
      width: rect.width,
      height: rect.height,
    };
  }

  function project(
    node,
    width,
    height,
    rotationY
  ) {
    const cosY =
      Math.cos(rotationY);

    const sinY =
      Math.sin(rotationY);

    const x1 =
      node.x * cosY -
      node.z * sinY;

    const z1 =
      node.x * sinY +
      node.z * cosY;

    const cosX =
      Math.cos(rotationX);

    const sinX =
      Math.sin(rotationX);

    const y2 =
      node.y * cosX -
      z1 * sinX;

    const z2 =
      node.y * sinX +
      z1 * cosX;

    const perspective =
      1 /
      (
        1.15 -
        z2 * 0.12
      );

    const radius =
      Math.min(
        width,
        height
      ) * 0.405;

    return {
      x:
        width / 2 +
        x1 *
        radius *
        perspective,

      y:
        height / 2 +
        y2 *
        radius *
        perspective,

      z: z2,

      depth:
        (z2 + 1) / 2,
    };
  }

  function render(timestamp = 0) {
    const {
      width,
      height,
    } = resize();

    const rotationY =
      rotationDuration > 0
        ? baseRotationY +
          (
            timestamp %
            rotationDuration
          ) /
            rotationDuration *
            Math.PI *
            2
        : baseRotationY;

    ctx.clearRect(
      0,
      0,
      width,
      height
    );

    const projected =
      nodes.map(
        node =>
          project(
            node,
            width,
            height,
            rotationY
          )
      );

    /*
     * Light network geometry for the
     * dark application shell.
     */

    edges.forEach(
      ([a, b]) => {
        const p1 =
          projected[a];

        const p2 =
          projected[b];

        const depth =
          (
            p1.depth +
            p2.depth
          ) / 2;

        if (
          lineDepthCutoff !== null &&
          depth < lineDepthCutoff
        ) {
          return;
        }

        const alpha =
          lineAlphaMin +
          depth *
            (lineAlphaMax - lineAlphaMin);

        ctx.beginPath();

        ctx.moveTo(
          p1.x,
          p1.y
        );

        ctx.lineTo(
          p2.x,
          p2.y
        );

        ctx.strokeStyle =
          `rgba(${lineColor}, ${alpha})`;

        ctx.lineWidth =
          0.55 +
          depth * 0.45;

        ctx.stroke();
      }
    );

    /*
     * Signal points use the application's
     * existing green visual language.
     */

    const ordered =
      projected
        .map(
          point => ({
            ...point,
          })
        )
        .sort(
          (a, b) =>
            a.z - b.z
        );

    ordered.forEach(
      point => {
        const radius =
          0.55 +
          point.depth *
            (nodeRadiusMax - 0.55);

        const alpha =
          nodeAlphaMin +
          point.depth *
            (nodeAlphaMax - nodeAlphaMin);

        ctx.beginPath();

        ctx.arc(
          point.x,
          point.y,
          radius,
          0,
          Math.PI * 2
        );

        if (nodeStyle === 'stroke') {
          ctx.strokeStyle =
            `rgba(${nodeColor}, ${alpha})`;

          ctx.lineWidth =
            nodeStrokeWidth;

          ctx.stroke();
        } else {
          ctx.fillStyle =
            `rgba(${nodeColor}, ${alpha})`;

          ctx.fill();
        }
      }
    );
  }

  window.addEventListener(
    'resize',
    () => {
      requestAnimationFrame(
        render
      );
    }
  );

  if (rotationDuration > 0) {
    const animate = timestamp => {
      render(timestamp);
      requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  } else {
    requestAnimationFrame(render);
  }
};

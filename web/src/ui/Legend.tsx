import { SOUND_LEGEND } from '../audio/map';

export function Legend() {
  return (
    <details className="legend">
      <summary>How events become sounds</summary>
      <table>
        <caption className="visually-hidden">Event to sound mapping</caption>
        <thead>
          <tr>
            <th scope="col">Network event</th>
            <th scope="col">Sound</th>
          </tr>
        </thead>
        <tbody>
          {SOUND_LEGEND.map((row) => (
            <tr key={row.id} style={{ '--hue': row.hue } as React.CSSProperties}>
              <td>
                <span className="swatch" aria-hidden="true" />
                {row.event}
              </td>
              <td>{row.sound}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>
        Under everything: a slow drone and a soft pulse. The pulse tempo follows the number of agents
        online, so a busy night beats faster than a quiet morning.
      </p>
    </details>
  );
}

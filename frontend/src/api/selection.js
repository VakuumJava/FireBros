import { readSelection } from "../workspace/selectionUrl";

export function initialSelection(search, latest, hash = "") {
  return readSelection(search, latest, hash);
}

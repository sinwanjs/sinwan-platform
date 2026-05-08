export { Http } from "./http";

import { Scope } from "../../interfaces";
import { Http } from "./http";


@Http.Controller({scope:Scope.REQUEST})
function example() {
  // ...
}

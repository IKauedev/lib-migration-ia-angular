// AngularJS sample service
angular.module("app").service("UserService", [
  "$http",
  function ($http) {
    this.getAll = function () {
      return $http.get("/api/users");
    };

    this.getById = function (id) {
      return $http.get("/api/users/" + id);
    };

    this.create = function (user) {
      return $http.post("/api/users", user);
    };

    this.update = function (id, user) {
      return $http.put("/api/users/" + id, user);
    };

    this.delete = function (id) {
      return $http.delete("/api/users/" + id);
    };
  },
]);

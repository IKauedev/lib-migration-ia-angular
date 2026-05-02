// AngularJS sample controller
angular.module("app", []).controller("UserController", [
  "$scope",
  "$http",
  function ($scope, $http) {
    $scope.users = [];
    $scope.loading = false;

    $scope.loadUsers = function () {
      $scope.loading = true;
      $http.get("/api/users").then(function (res) {
        $scope.users = res.data;
        $scope.loading = false;
      });
    };

    $scope.deleteUser = function (id) {
      $http.delete("/api/users/" + id).then(function () {
        $scope.users = $scope.users.filter(function (u) {
          return u.id !== id;
        });
      });
    };

    $scope.loadUsers();
  },
]);

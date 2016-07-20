uis.directive('uiSelectSingle', ['$timeout','$compile', function($timeout, $compile) {
  return {
    restrict: 'EA',
    require: ['^uiSelect', '^ngModel'],
    link: function(scope, element, attrs, ctrls) {

      var $select = ctrls[0];
      var ngModel = ctrls[1];

      //From view --> model
      ngModel.$parsers.unshift(function (inputValue) {
        var locals = {},
            result;
        locals[$select.parserResult.itemName] = inputValue;
        result = $select.parserResult.modelMapper(scope, locals);
        return result;
      });

      //From model --> view
      ngModel.$formatters.unshift(function (inputValue) {
        var data = $select.parserResult && $select.parserResult.source (scope, { $select : {search:''}}), //Overwrite $search
            locals = {},
            result;
        if (data){
          var checkFnSingle = function(d){
            locals[$select.parserResult.itemName] = d;
            result = $select.parserResult.modelMapper(scope, locals);
            return result === inputValue;
          };
          //If possible pass same object stored in $select.selected
          if ($select.selected && checkFnSingle($select.selected)) {
            return $select.selected;
          }
          for (var i = data.length - 1; i >= 0; i--) {
            if (checkFnSingle(data[i])) return data[i];
          }
        }
        return inputValue;
      });

      //Update viewValue if model change
      scope.$watch('$select.selected', function(newValue) {
        if (ngModel.$viewValue !== newValue) {
          ngModel.$setViewValue(newValue);
        }
      });

      ngModel.$render = function() {
        $select.selected = ngModel.$viewValue;
      };

      scope.$on('uis:select', function (event, item) {
        $select.selected = item;
        var locals = {};        
        locals[$select.parserResult.itemName] = item;

        $timeout(function(){
          $select.onSelectCallback(scope, {
            $item: item,
            $model: $select.parserResult.modelMapper(scope, locals)
          });
        });
      });

      scope.$on('uis:close', function (event, skipFocusser) {
        $timeout(function(){
          $select.focusser.prop('disabled', false);
          if (!skipFocusser) $select.focusser[0].focus();
        },0,false);
      });

      scope.$on('uis:activate', function () {
        focusser.prop('disabled', true); //Will reactivate it on .close()
      });

      //Idea from: https://github.com/ivaynberg/select2/blob/79b5bf6db918d7560bdd959109b7bcfb47edaf43/select2.js#L1954
      var focusser = angular.element("<input ng-disabled='$select.disabled' class='ui-select-focusser ui-select-offscreen' type='text' id='{{ $select.focusserId }}' aria-label='{{ $select.focusserTitle }}' aria-haspopup='true' role='button' />");
      $compile(focusser)(scope);
      $select.focusser = focusser;

      //Input that will handle focus
      $select.focusInput = focusser;

      element.parent().append(focusser);
      focusser.bind("focus", function(){
        scope.$evalAsync(function(){
          $select.focus = true;
        });
      });
      focusser.bind("blur", function(){
        scope.$evalAsync(function(){
          $select.focus = false;
        });
      });
      focusser.bind("keydown", function(e){

        if (e.which === KEY.BACKSPACE && $select.backspaceReset !== false) {
          e.preventDefault();
          e.stopPropagation();
          $select.select(undefined);
          scope.$apply();
          return;
        }

        if (e.which === KEY.TAB || KEY.isControl(e) || KEY.isFunctionKey(e) || e.which === KEY.ESC) {
          return;
        }

        if (e.which == KEY.DOWN  || e.which == KEY.UP || e.which == KEY.ENTER || e.which == KEY.SPACE){
          e.preventDefault();
          e.stopPropagation();
          $select.activate();
        }

        scope.$digest();
      });

      focusser.bind("keyup input", function(e){

        if (e.which === KEY.TAB || KEY.isControl(e) || KEY.isFunctionKey(e) || e.which === KEY.ESC || e.which == KEY.ENTER || e.which === KEY.BACKSPACE) {
          return;
        }

        $select.activate(focusser.val()); //User pressed some regular key, so we pass it to the search input
        focusser.val('');
        scope.$digest();

      });

        //Copied from multiselect
      $select.searchInput.on('keyup', function (e) {

          if (!KEY.isVerticalMovement(e.which)) {
              scope.$evalAsync(function () {
                  $select.activeIndex = $select.taggingLabel === false ? -1 : 0;
              });
          }
          // Push a "create new" item into array if there is a search string
          if ($select.tagging.isActivated && $select.search.length > 0) {

              // return early with these keys
              if (e.which === KEY.TAB || KEY.isControl(e) || KEY.isFunctionKey(e) || e.which === KEY.ESC || KEY.isVerticalMovement(e.which)) {
                  return;
              }
              // always reset the activeIndex to the first item when tagging
              $select.activeIndex = $select.taggingLabel === false ? -1 : 0;
              // taggingLabel === false bypasses all of this
              if ($select.taggingLabel === false) return;

              var items = angular.copy($select.items);
              var stashArr = angular.copy($select.items);
              var newItem;
              var item;
              var hasTag = false;
              var dupeIndex = -1;
              var tagItems;
              var tagItem;

              // case for object tagging via transform `$select.tagging.fct` function
              if ($select.tagging.fct !== undefined) {
                  tagItems = $select.$filter('filter')(items, { 'isTag': true });
                  if (tagItems.length > 0) {
                      tagItem = tagItems[0];
                  }
                  // remove the first element, if it has the `isTag` prop we generate a new one with each keyup, shaving the previous
                  if (items.length > 0 && tagItem) {
                      hasTag = true;
                      items = items.slice(1, items.length);
                      stashArr = stashArr.slice(1, stashArr.length);
                  }
                  newItem = $select.tagging.fct($select.search);
                  // verify the new tag doesn't match the value of a possible selection choice or an already selected item.
                  if (
                    stashArr.some(function (origItem) {
                       return angular.equals(origItem, newItem);
                  })) {
                      scope.$evalAsync(function () {
                          $select.activeIndex = 0;
                          $select.items = items;
                      });
                      return;
                  }
                  if (newItem) newItem.isTag = true;
                  // handle newItem string and stripping dupes in tagging string context
              } else {
                  // find any tagging items already in the $select.items array and store them
                  tagItems = $select.$filter('filter')(items, function (item) {
                      return item.match($select.taggingLabel);
                  });
                  if (tagItems.length > 0) {
                      tagItem = tagItems[0];
                  }
                  item = items[0];
                  // remove existing tag item if found (should only ever be one tag item)
                  if (item !== undefined && items.length > 0 && tagItem) {
                      hasTag = true;
                      items = items.slice(1, items.length);
                      stashArr = stashArr.slice(1, stashArr.length);
                  }
                  newItem = $select.search + ' ' + $select.taggingLabel;
                  if (_findApproxDupe($select.selected, $select.search) > -1) {
                      return;
                  }
                  // verify the the tag doesn't match the value of an existing item from
                  // the searched data set or the items already selected
                  if (_findCaseInsensitiveDupe(stashArr.concat($select.selected))) {
                      // if there is a tag from prev iteration, strip it / queue the change
                      // and return early
                      if (hasTag) {
                          items = stashArr;
                          scope.$evalAsync(function () {
                              $select.activeIndex = 0;
                              $select.items = items;
                          });
                      }
                      return;
                  }
                  if (_findCaseInsensitiveDupe(stashArr)) {
                      // if there is a tag from prev iteration, strip it
                      if (hasTag) {
                          $select.items = stashArr.slice(1, stashArr.length);
                      }
                      return;
                  }
              }
              if (hasTag) dupeIndex = _findApproxDupe($select.selected, newItem);
              // dupe found, shave the first item
              if (dupeIndex > -1) {
                  items = items.slice(dupeIndex + 1, items.length - 1);
              } else {
                  items = [];
                  if (newItem) items.push(newItem);
                  items = items.concat(stashArr);
              }
              scope.$evalAsync(function () {
                  $select.activeIndex = 0;
                  $select.items = items;

                  if ($select.isGrouped) {
                      // update item references in groups, so that indexOf will work after angular.copy
                      var itemsWithoutTag = newItem ? items.slice(1) : items;
                      $select.setItemsFn(itemsWithoutTag);
                      if (newItem) {
                          // add tag item as a new group
                          $select.items.unshift(newItem);
                          $select.groups.unshift({ name: '', items: [newItem], tagging: true });
                      }
                  }
              });
          }
      });
<<<<<<< HEAD
      
      //Copied from uiSelectMultipleDirective
      function _findCaseInsensitiveDupe(arr) {
        if ( arr === undefined || $select.search === undefined ) {
          return false;
        }
        var hasDupe = arr.filter( function (origItem) {
          if ( $select.search.toUpperCase() === undefined || origItem === undefined ) {
            return false;
          }
          return origItem.toUpperCase() === $select.search.toUpperCase();
        }).length > 0;

        return hasDupe;
      }
=======
>>>>>>> 2641bf6... fix(uiSelectSingle): Tagging without multiple with new tags doesn't works

      //Copied from uiSelectMultipleDirective
      function _findApproxDupe(haystack, needle) {
          var dupeIndex = -1;
          if (angular.isArray(haystack)) {
              var tempArr = angular.copy(haystack);
              for (var i = 0; i < tempArr.length; i++) {
                  // handle the simple string version of tagging
                  if ($select.tagging.fct === undefined) {
                      // search the array for the match
                      if (tempArr[i] + ' ' + $select.taggingLabel === needle) {
                          dupeIndex = i;
                      }
                      // handle the object tagging implementation
                  } else {
                      var mockObj = tempArr[i];
                      if (angular.isObject(mockObj)) {
                          mockObj.isTag = true;
                      }
                      if (angular.equals(mockObj, needle)) {
                          dupeIndex = i;
                      }
                  }
              }
          }
          return dupeIndex;
      }


    }
  };
}]);

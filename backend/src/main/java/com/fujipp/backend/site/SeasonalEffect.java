package com.fujipp.backend.site;

import com.fasterxml.jackson.annotation.JsonCreator;

enum SeasonalEffect {
    NONE, HALLOWEEN, CHRISTMAS, VALENTINE;

    @JsonCreator
    static SeasonalEffect fromValue(String value) {
        return valueOf(value);
    }
}

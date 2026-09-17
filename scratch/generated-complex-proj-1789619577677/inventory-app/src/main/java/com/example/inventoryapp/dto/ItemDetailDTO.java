package com.example.inventoryapp.dto;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ItemDetailDTO {

    private Long id;

    private String description;
}

package com.example.inventoryapp.mapper;

import com.example.inventoryapp.dto.ItemDTO;
import com.example.inventoryapp.entity.Item;
import org.springframework.stereotype.Component;

@Component
public class ItemMapper {

    public ItemDTO toDto(Item entity) {
        if (entity == null) return null;

        ItemDTO dto = new ItemDTO();
        dto.setCode(entity.getCode());
        dto.setName(entity.getName());
        return dto;
    }

    public Item toEntity(ItemDTO dto) {
        if (dto == null) return null;

        Item entity = new Item();
        entity.setCode(dto.getCode());
        entity.setName(dto.getName());
        return entity;
    }

    public void updateEntityFromDto(ItemDTO dto, Item entity) {
        if (dto == null || entity == null) return;

        if (dto.getName() != null) {
            entity.setName(dto.getName());
        }
    }
}
